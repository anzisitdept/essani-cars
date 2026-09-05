import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, websiteDb } from "./firebase";

/**
 * Normalizes vehicle object for public website schema
 */
export function buildWebsiteVehiclePayload(vehicle: any) {
  const price = typeof vehicle.askingPrice === "number"
    ? vehicle.askingPrice
    : parseFloat(vehicle.askingPrice) || 0;

  const year = vehicle.year
    ? (typeof vehicle.year === "number" ? vehicle.year : parseInt(vehicle.year) || 0)
    : (vehicle.modelYear ? parseInt(vehicle.modelYear) || 0 : 0);

  const isHidden = vehicle.isHidden === true || vehicle.status === "Hidden";
  const status = isHidden ? "Hidden" : (vehicle.status || "Available");

  return {
    sourceVehicleId: vehicle.sourceVehicleId || vehicle.id || null,
    type: vehicle.type || "Physical Showroom",
    make: vehicle.make || vehicle.brandName || "",
    brandName: vehicle.make || vehicle.brandName || "",
    model: vehicle.model || "",
    variant: vehicle.variant || "",
    year: year,
    modelYear: year,
    color: vehicle.color || "",
    fuelType: vehicle.fuelType || "",
    transmission: vehicle.transmission || "",
    city: vehicle.city || "Sukkur",
    engineNo: vehicle.engineNo || vehicle.engineNumber || "",
    chassisNo: vehicle.chassisNo || vehicle.chassisNumber || "",
    registrationNo: vehicle.registrationNo || vehicle.registrationNumber || "",
    askingPrice: price,
    price: price,
    images: vehicle.images || vehicle.assets || [],
    description: vehicle.description || "",
    status: status,
    isHidden: isHidden,
    barcode: vehicle.barcode || "",
    isSold: vehicle.status === "Sold" || vehicle.isSold === true,
    publishedAt: vehicle.publishedAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

/**
 * Sync a published vehicle listing to the public website Firestore database
 */
export async function syncVehicleToWebsite(vehicleDocId: string, vehicleData: any) {
  try {
    const payload = buildWebsiteVehiclePayload(vehicleData);
    const targetRef = doc(websiteDb, "website-inventory", vehicleDocId);
    await setDoc(targetRef, payload, { merge: true });
    console.log(`[WebsiteSync] Successfully synced vehicle ${vehicleDocId} to website db`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error syncing vehicle ${vehicleDocId} to website db:`, error);
    return { success: false, error };
  }
}

/**
 * Toggle hide/unhide visibility of a published vehicle on both accounts DB and website DB
 */
export async function toggleWebsiteVehicleVisibility(vehicleDocId: string, currentIsHidden: boolean) {
  const newIsHidden = !currentIsHidden;
  const newStatus = newIsHidden ? "Hidden" : "Available";

  try {
    // 1. Update Accounts database
    const accountsRef = doc(db, "website-inventory", vehicleDocId);
    await updateDoc(accountsRef, {
      status: newStatus,
      isHidden: newIsHidden,
      updatedAt: serverTimestamp()
    });

    // 2. Update Website database
    const websiteRef = doc(websiteDb, "website-inventory", vehicleDocId);
    await setDoc(websiteRef, {
      status: newStatus,
      isHidden: newIsHidden,
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log(`[WebsiteSync] Successfully toggled vehicle ${vehicleDocId} visibility to: ${newStatus}`);
    return { success: true, isHidden: newIsHidden, status: newStatus };
  } catch (error) {
    console.error(`[WebsiteSync] Error toggling vehicle ${vehicleDocId} visibility:`, error);
    return { success: false, error };
  }
}

/**
 * Update the status of a vehicle listing on the public website (e.g. "Sold", "Available", "Hidden")
 */
export async function updateWebsiteVehicleStatus(vehicleDocId: string, status: string) {
  try {
    const isHidden = status === "Hidden";
    const targetRef = doc(websiteDb, "website-inventory", vehicleDocId);
    await setDoc(targetRef, {
      status,
      isHidden: isHidden,
      isSold: status === "Sold",
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[WebsiteSync] Successfully updated status to ${status} for vehicle ${vehicleDocId}`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error updating status for vehicle ${vehicleDocId}:`, error);
    return { success: false, error };
  }
}

/**
 * Update images array for a vehicle listing on the public website
 */
export async function updateWebsiteVehicleImages(vehicleDocId: string, images: string[]) {
  try {
    const targetRef = doc(websiteDb, "website-inventory", vehicleDocId);
    await setDoc(targetRef, {
      images: images,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[WebsiteSync] Successfully updated images for vehicle ${vehicleDocId}`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error updating images for vehicle ${vehicleDocId}:`, error);
    return { success: false, error };
  }
}

/**
 * Delete a vehicle listing from the public website
 */
export async function removeVehicleFromWebsite(vehicleDocId: string) {
  try {
    const targetRef = doc(websiteDb, "website-inventory", vehicleDocId);
    await deleteDoc(targetRef);
    console.log(`[WebsiteSync] Successfully removed vehicle ${vehicleDocId} from website db`);
    return { success: true };
  } catch (error) {
    console.error(`[WebsiteSync] Error removing vehicle ${vehicleDocId} from website db:`, error);
    return { success: false, error };
  }
}

