import "./App.css";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useEffect, useState } from "react";
import CompanyTable from "./components/CompanyTable";
import { getCollectionsMetadata } from "./utils/jam-api";
import useApi from "./utils/useApi";
import Button from "@mui/material/Button";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2", // Blue for primary
    },
    secondary: {
      main: "#ff4081", // Pink for secondary
    },
  },
  shape: {
    borderRadius: 12, // Consistent rounded corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none", // Prevent all caps
          padding: "8px 16px",
          fontSize: "1rem",
        },
      },
    },
  },
});

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const [myListId, setMyListId] = useState<string>();
  const [likedCompaniesId, setLikedCompaniesId] = useState<string>();
  const { data: collectionResponse } = useApi(() => getCollectionsMetadata());

  useEffect(() => {
    const filteredCollections = collectionResponse?.filter(
      (collection) => collection.collection_name !== "Companies to Ignore List"
    );

    setSelectedCollectionId(filteredCollections?.[0]?.id);

    filteredCollections?.forEach((collection) => {
      if (collection.collection_name === "My List") {
        setMyListId(collection.id);
      } else if (collection.collection_name === "Liked Companies List") {
        setLikedCompaniesId(collection.id);
      }
    });
  }, [collectionResponse]);

  const switchCollection = (id: string) => {
    setSelectedCollectionId(id);
    window.history.pushState({}, "", `?collection=${id}`);
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <div className="flex flex-col items-center">
        <div className="font-bold text-2xl border-b-2 p-4 mb-6 text-center">
          Harmonic Jam
        </div>
        <div className="flex justify-center gap-4 mb-6">
          <Button
            variant="contained"
            color={selectedCollectionId === myListId ? "primary" : "secondary"}
            onClick={() => switchCollection(myListId!)}
            disabled={!myListId}
          >
            My List
          </Button>
          <Button
            variant="contained"
            color={selectedCollectionId === likedCompaniesId ? "primary" : "secondary"}
            onClick={() => switchCollection(likedCompaniesId!)}
            disabled={!likedCompaniesId}
          >
            Liked Companies
          </Button>
        </div>
        <div className="flex justify-center w-full">
          <div className="w-3/4">
            {selectedCollectionId && (
              <CompanyTable
                selectedCollectionId={selectedCollectionId}
                myListId={myListId}
                likedCompaniesId={likedCompaniesId}
              />
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
