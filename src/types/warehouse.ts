/**
 * Payload for creating a new warehouse.
 */
export interface WarehouseCreatePayload {
  title: string;
  contactPersonName: string;
  company: string;
  email: string;
  phone: string;
  phonePrint?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude?: string;
  longitude?: string;
  gstNo?: string;
  fssaiCode?: string;
  vendorId: string;
  shipwayWarehouseId?: string;
}

/**
 * Payload for updating an existing warehouse.
 * All fields are optional.
 */
export type WarehouseUpdatePayload = Partial<WarehouseCreatePayload>;
