"use client";

import { useLoadScript, GoogleMap, Marker, InfoWindow, MarkerClusterer } from "@react-google-maps/api";
import { useMemo, useState } from "react";
import { buildings, districtColors } from "../data/buildings";
import type { Building } from "../types/buildings";

// Definim tipul pentru un anunț OLX
interface Listing {
  price: string;
  url: string;
}

// Definim tipul pentru datele preluate de la API
interface AveragePrice {
  sale: Listing[];
  rent: Listing[];
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function Hero() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [averagePrice, setAveragePrice] = useState<AveragePrice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const center = useMemo(() => ({ lat: 44.4268, lng: 26.1025 }), []);

  const options = useMemo(
    () => ({
      disableDefaultUI: true,
      clickableIcons: false,
    }),
    []
  );

  const fetchAveragePrice = async (address: string, name: string) => {
    try {
      setIsLoading(true);

      const url = `/api/fetchPrice?address=${encodeURIComponent(address)}&name=${encodeURIComponent(name)}`;
      console.log("📡 Fetching price for:", { address, name });

      const response = await fetch(url);
      const data: AveragePrice = await response.json();

      setAveragePrice({
        sale: data.sale || [],
        rent: data.rent || [],
      });
    } catch (error) {
      console.error("Eroare la preluarea prețului:", error);
      setAveragePrice({
        sale: [],
        rent: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkerClick = (building: Building) => {
    setSelectedBuilding(building);
    setAveragePrice(null);
    fetchAveragePrice(building.address, building.name || "");
  };

  const handleInfoWindowClose = () => {
    setSelectedBuilding(null);
    setAveragePrice(null);
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <section className="w-full h-screen relative">
      <GoogleMap zoom={11} center={center} mapContainerClassName="w-full h-full" options={options}>
        <MarkerClusterer>
          {(clusterer) => (
            <>
              {buildings.map((building) => (
                <Marker
                  key={building.name}
                  position={building.position}
                  onClick={() => handleMarkerClick(building)}
                  clusterer={clusterer}
                  icon={{
                    path: "M-1.547 12l6.563-6.609-1.406-1.406-5.156 5.203-2.063-2.109-1.406 1.406zM0 0q2.906 0 4.945 2.039t2.039 4.945q0 1.453-0.727 3.328t-1.758 3.516-2.039 3.070-1.711 2.273l-0.75 0.797q-0.281-0.328-0.75-0.867t-1.688-2.156-2.133-3.141-1.664-3.445-0.75-3.375q0-2.906 2.039-4.945t4.945-2.039z",
                    fillColor: districtColors[building.district],
                    fillOpacity: 0.6,
                    strokeWeight: 0,
                    scale: 2,
                    anchor: new google.maps.Point(0, 20),
                  }}
                />
              ))}
            </>
          )}
        </MarkerClusterer>

        {selectedBuilding && (
          <InfoWindow position={selectedBuilding.position} onCloseClick={handleInfoWindowClose}>
            <div className="max-w-xs">
              <a
                href={selectedBuilding.web}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-blue-600 hover:text-blue-800"
              >
                {selectedBuilding.name}
              </a>
              <p className="text-sm">
                <span className="font-semibold">Adresa: </span>
                {selectedBuilding.address}
              </p>
              <p className="text-sm font-medium mt-1">
                <span className="font-semibold">Cartier: </span>
                {selectedBuilding.cartier}
              </p>

              {/* Loader în timpul scrapingului */}
              {isLoading ? (
                <div className="flex items-center mt-2">
                  <span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-gray-500 rounded-full"></span>
                  <span className="ml-2 text-gray-500">Căutare...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {/* Anunțuri de vânzare */}
                  <div>
                    <span className="font-semibold">Vânzare</span>
                    {averagePrice?.sale.map((listing, index) => (
                      <p key={`sale-${index}`} className="text-sm">
                        {listing.price} -{" "}
                        <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                          Vezi anunț
                        </a>
                      </p>
                    ))}
                  </div>

                  {/* Anunțuri de închiriere */}
                  <div>
                    <span className="font-semibold">Închiriere</span>
                    {averagePrice?.rent.map((listing, index) => (
                      <p key={`rent-${index}`} className="text-sm">
                        {listing.price} -{" "}
                        <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                          Vezi anunț
                        </a>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </section>
  );
}
