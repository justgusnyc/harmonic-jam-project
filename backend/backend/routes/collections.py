import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


# Models for response and request
class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


class MoveCompaniesRequest(BaseModel):
    destination_id: uuid.UUID  # Changed to UUID for consistency
    company_ids: list[int]


# Route to get metadata of all collections
@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


# Route to get companies from a specific collection
@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    # Check if the collection is "Liked Companies List"
    is_liked_collection = (
        db.query(database.CompanyCollection)
        .filter(database.CompanyCollection.id == collection_id)
        .first()
        .collection_name == "Liked Companies List"
    )

    # Fetch company IDs based on association
    liked_list_id = (
        db.query(database.CompanyCollection.id)
        .filter(database.CompanyCollection.collection_name == "Liked Companies List")
        .scalar()
    )

    if is_liked_collection:
        # Query for "Liked Companies List" directly
        query = (
            db.query(database.CompanyCollectionAssociation, database.Company)
            .join(database.Company)
            .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        )
    else:
        # Query for "My List" and exclude companies in "Liked Companies List"
        subquery = (
            db.query(database.CompanyCollectionAssociation.company_id)
            .filter(database.CompanyCollectionAssociation.collection_id == liked_list_id)
            .subquery()
        )

        query = (
            db.query(database.CompanyCollectionAssociation, database.Company)
            .join(database.Company)
            .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
            .filter(~database.Company.id.in_(subquery))  # Exclude companies in the subquery
        )

    # Count total companies that match the filter
    total_count = query.with_entities(func.count()).scalar()

    # Fetch paginated results
    results = query.offset(offset).limit(limit).all()

    # Convert the results to the appropriate response format
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .filter(database.CompanyCollection.id == collection_id)
        .first()
        .collection_name,
        companies=companies,
        total=total_count,
    )


# Route to move companies between collections
@router.post("/{source_id}/move")
def move_companies(
    source_id: uuid.UUID,  # Changed to UUID for consistency
    request: MoveCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    destination_id = request.destination_id
    company_ids = request.company_ids

    try:
        # Ensure the source and destination collections exist
        source_collection = (
            db.query(database.CompanyCollection)
            .filter(database.CompanyCollection.id == source_id)
            .first()
        )

        destination_collection = (
            db.query(database.CompanyCollection)
            .filter(database.CompanyCollection.id == destination_id)
            .first()
        )

        # Add logging to confirm UUIDs
        print(f"Source ID: {source_id}, Destination ID: {destination_id}")
        print(
            f"Source Collection: {source_collection}, Destination Collection: {destination_collection}"
        )

        if not source_collection:
            raise HTTPException(
                status_code=404, detail=f"Source collection {source_id} not found"
            )

        if not destination_collection:
            raise HTTPException(
                status_code=404,
                detail=f"Destination collection {destination_id} not found",
            )

        # Move companies by updating their associations
        associations = (
            db.query(database.CompanyCollectionAssociation)
            .filter(
                database.CompanyCollectionAssociation.company_id.in_(company_ids),
                database.CompanyCollectionAssociation.collection_id == source_id,
            )
            .all()
        )

        # Update collection associations
        for association in associations:
            association.collection_id = destination_id

        db.commit()
        return {"message": f"Moved {len(associations)} companies successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to move companies: {str(e)}"
        )
    

# Route to move all companies between collections
@router.post("/{source_id}/move_all")
def move_all_companies(
    source_id: uuid.UUID,
    destination_id: uuid.UUID = Query(...),
    db: Session = Depends(database.get_db),
):
    try:
        # Ensure the source and destination collections exist
        source_collection = (
            db.query(database.CompanyCollection)
            .filter(database.CompanyCollection.id == source_id)
            .first()
        )

        destination_collection = (
            db.query(database.CompanyCollection)
            .filter(database.CompanyCollection.id == destination_id)
            .first()
        )

        if not source_collection:
            raise HTTPException(
                status_code=404, detail=f"Source collection {source_id} not found"
            )

        if not destination_collection:
            raise HTTPException(
                status_code=404,
                detail=f"Destination collection {destination_id} not found",
            )

        # Fetch all company IDs in the source collection
        company_ids = (
            db.query(database.CompanyCollectionAssociation.company_id)
            .filter(database.CompanyCollectionAssociation.collection_id == source_id)
            .all()
        )
        
        # Extract company IDs as a list
        company_ids = [id_tuple[0] for id_tuple in company_ids]

        # Fetch companies already in the destination to exclude them
        existing_in_destination = (
            db.query(database.CompanyCollectionAssociation.company_id)
            .filter(database.CompanyCollectionAssociation.collection_id == destination_id)
            .all()
        )
        existing_ids = {id_tuple[0] for id_tuple in existing_in_destination}

        # Exclude companies already in the destination
        company_ids_to_move = [company_id for company_id in company_ids if company_id not in existing_ids]

        # Move companies by updating their associations in batches
        batch_size = 1000
        for i in range(0, len(company_ids_to_move), batch_size):
            batch = company_ids_to_move[i:i + batch_size]
            associations = (
                db.query(database.CompanyCollectionAssociation)
                .filter(
                    database.CompanyCollectionAssociation.company_id.in_(batch),
                    database.CompanyCollectionAssociation.collection_id == source_id,
                )
                .all()
            )

            # Update collection associations
            for association in associations:
                association.collection_id = destination_id

        db.commit()
        return {"message": f"Moved {len(company_ids_to_move)} companies successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to move companies: {str(e)}"
        )
