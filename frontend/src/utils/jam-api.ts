import axios from 'axios';

export interface ICompany {
    id: number;
    company_name: string;
    liked: boolean;
}

export interface ICollection {
    id: string;
    collection_name: string;
    companies: ICompany[];
    total: number;
}

export interface ICompanyBatchResponse {
    companies: ICompany[];
}

const BASE_URL = 'http://localhost:8000';

export async function getCompanies(offset?: number, limit?: number): Promise<ICompanyBatchResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/companies`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsById(id: string, offset?: number, limit?: number): Promise<ICollection> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${id}`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
    try {
        const response = await axios.get(`${BASE_URL}/collections`);
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function moveCompaniesInBatches(
    sourceId: string,
    destinationId: string,
    companyIds: number[],
    batchSize: number = 100
) {
    // Directly handle small lists without chunking
    if (companyIds.length <= batchSize) {
        try {
            const response = await axios.post(`${BASE_URL}/collections/${sourceId}/move`, {
                destination_id: destinationId, // Updated key name
                company_ids: companyIds, // Updated key name
            });
            console.log(`Moved ${companyIds.length} companies successfully.`);
            return response.data;
        } catch (error) {
            console.error('Error moving companies:', error);
            throw error;
        }
    }

    // Proceed with batch processing for larger lists
    const chunkArray = (array: number[], size: number) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    };

    const batches = chunkArray(companyIds, batchSize);
    for (let i = 0; i < batches.length; i++) {
        try {
            const response = await axios.post(`${BASE_URL}/collections/${sourceId}/move`, {
                destination_id: destinationId, // Updated key name
                company_ids: batches[i], // Updated key name
            });
            console.log(`Batch ${i + 1}/${batches.length} moved successfully.`);
        } catch (error) {
            console.error(`Error moving batch ${i + 1}/${batches.length}:`, error);
            throw error;
        }
    }
}


export async function moveAllCompanies(sourceId: string, destinationId: string) {
    try {
        const response = await axios.post(`${BASE_URL}/collections/${sourceId}/move_all`, null, { 
            params: {
                destination_id: destinationId
            }
        });
        console.log(`Moved all companies successfully.`);
        return response.data;
    } catch (error) {
        console.error('Error moving all companies:', error);
        throw error;
    }
}




