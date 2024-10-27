import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { getCollectionsById, moveCompaniesInBatches, moveAllCompanies, ICompany } from "../utils/jam-api";
import Button from "@mui/material/Button";

const CompanyTable = (props: { selectedCollectionId: string, myListId?: string, likedCompaniesId?: string }) => {
    const [response, setResponse] = useState<ICompany[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [pageSize, setPageSize] = useState(25);
    const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
    const [buttonLoading, setButtonLoading] = useState<boolean>(false);
    const [fetching, setFetching] = useState<boolean>(false);

    const fetchCompanies = () => {
        setFetching(true);
        getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
            (newResponse) => {
                setResponse(newResponse.companies);
                setTotal(newResponse.total);
            }
        ).finally(() => {
            setFetching(false);
        });
    };

    useEffect(() => {
        fetchCompanies();
    }, [props.selectedCollectionId, offset, pageSize]);

    useEffect(() => {
        setOffset(0);
    }, [props.selectedCollectionId]);

    // Determine destination ID and button label
    const isMyList = props.selectedCollectionId === props.myListId;
    const destinationId = isMyList ? props.likedCompaniesId : props.myListId;
    const buttonLabel = isMyList ? "Move to Liked Companies" : "Move to My List";
    const moveAllLabel = isMyList ? "Move All to Liked Companies" : "Move All to My List";

    const handleMoveCompanies = async () => {
        if (!destinationId) {
            alert("Destination not defined.");
            return;
        }

        if (selectedCompanies.length === 0) {
            alert("Please select companies to move.");
            return;
        }

        try {
            setButtonLoading(true);
            await moveCompaniesInBatches(props.selectedCollectionId, destinationId, selectedCompanies);
            alert(`Successfully moved ${selectedCompanies.length} companies!`);
            setSelectedCompanies([]);
            fetchCompanies(); // Refresh the list after move
        } catch (error) {
            console.error("Failed to move companies:", error);
            alert("An error occurred while moving companies.");
        } finally {
            setButtonLoading(false);
        }
    };

    const handleMoveAllCompanies = async () => {
        if (!destinationId) {
            alert("Destination not defined.");
            return;
        }

        try {
            setButtonLoading(true);
            await moveAllCompanies(props.selectedCollectionId, destinationId);
            alert("Successfully moved all companies!");
            fetchCompanies(); // Refresh the list after move
        } catch (error) {
            console.error("Failed to move all companies:", error);
            alert("An error occurred while moving all companies.");
        } finally {
            setButtonLoading(false);
        }
    };

    return (
        <div style={{ height: 600, width: "80%", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleMoveCompanies}
                    disabled={selectedCompanies.length === 0 || buttonLoading}
                    style={{ borderRadius: "20px", marginRight: "10px" }}
                >
                    {buttonLoading ? "Processing..." : buttonLabel}
                </Button>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleMoveAllCompanies}
                    disabled={buttonLoading}
                    style={{ borderRadius: "20px" }}
                >
                    {buttonLoading ? "Processing..." : moveAllLabel}
                </Button>
            </div>
            <DataGrid
                rows={response}
                rowHeight={30}
                columns={[
                    { field: "liked", headerName: "Liked", width: 90 },
                    { field: "id", headerName: "ID", width: 90 },
                    { field: "company_name", headerName: "Company Name", width: 200 },
                ]}
                initialState={{
                    pagination: {
                        paginationModel: { page: 0, pageSize: 25 },
                    },
                }}
                rowCount={total}
                pagination
                loading={fetching} // Show loading indicator within the DataGrid
                checkboxSelection
                paginationMode="server"
                onRowSelectionModelChange={(newSelection) => {
                    setSelectedCompanies(newSelection as number[]);
                }}
                onPaginationModelChange={(newMeta) => {
                    setOffset(newMeta.page * newMeta.pageSize);
                    setPageSize(newMeta.pageSize);
                }}
            />
        </div>
    );
};

export default CompanyTable;
