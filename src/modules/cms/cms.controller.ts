import catchAsync from "@/utils/catchAsync";
import { status as httpStatus } from "http-status";
import pick from "@/utils/pick";
import cmsService from "./cms.service";

/**
 * Handler to fetch CMS content
 */
const getContent = catchAsync(async (_req, res) => {
  // delegate to service layer to fetch CMS content
  const response = await cmsService.getContent();

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Content fetched successfully",
    data: response,
  });
});

/**
 * Handler to update CMS content
 */
const updateContent = catchAsync(async (req, res) => {
  // delegate to service layer to update CMS content
  const response = await cmsService.updateContent();

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Content updated successfully",
    data: response,
  });
});

// ====== Carousel Banner ======

/**
 * Handler to get paginated carousel banners
 */
const getPaginatedCarouselBanner = catchAsync(async (req, res) => {
  // pick only allowed query parameters for filtering
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // pick pagination and sorting options
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated carousel banners
  const response = await cmsService.getPaginatedCarouselBanner(
    filters,
    options,
  );

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Carousel banner fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new carousel banner
 */
const createCarouselBanner = catchAsync(async (req, res) => {
  // extract banner data from request body
  const data = req.body;

  // delegate to service layer to create carousel banner
  const response = await cmsService.createCarouselBanner(data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Carousel banner created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing carousel banner
 */
const updateCarouselBanner = catchAsync(async (req, res) => {
  // extract banner id from route parameters
  const { id } = req.params;
  // extract updated banner data from request body
  const data = req.body;

  // delegate to service layer to update carousel banner
  const response = await cmsService.updateCarouselBanner(id, data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Carousel banner updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a carousel banner
 */
const deleteCarouselBanner = catchAsync(async (req, res) => {
  // extract banner id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete the carousel banner
  const response = await cmsService.deleteCarouselBanner(id);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Carousel banner deleted successfully",
    data: response,
  });
});

// ====== Featured Banner ======

/**
 * Handler to get paginated featured banners
 */
const getPaginatedFeaturedBanner = catchAsync(async (req, res) => {
  // extract only allowed filter fields from query parameters
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract sorting and pagination options from query parameters
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated featured banners
  const response = await cmsService.getPaginatedFeaturedBanner(
    filters,
    options,
  );

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Featured banner fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new featured banner
 */
const createFeaturedBanner = catchAsync(async (req, res) => {
  // extract banner data from request body
  const data = req.body;

  // delegate to service layer to create a new featured banner
  const response = await cmsService.createFeaturedBanner(data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Featured banner created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing featured banner
 */
const updateFeaturedBanner = catchAsync(async (req, res) => {
  // get banner id from route parameters
  const { id } = req.params;
  // get data for updating the banner
  const data = req.body;

  // delegate to service layer to update the featured banner
  const response = await cmsService.updateFeaturedBanner(id, data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Featured banner updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a featured banner
 */
const deleteFeaturedBanner = catchAsync(async (req, res) => {
  // get banner id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete a featured banner
  const response = await cmsService.deleteFeaturedBanner(id);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Featured banner deleted successfully",
    data: response,
  });
});

// ====== Who We Serve Banner ======

/**
 * Handler to get paginated "Who We Serve" banners
 */
const getPaginatedWhoWeServeBanner = catchAsync(async (req, res) => {
  // extract allowed filter parameters from query
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from query
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated "Who We Serve" banners
  const response = await cmsService.getPaginatedWhoWeServeBanner(
    filters,
    options,
  );

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Who we serve banner fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new "Who We Serve" banner
 */
const createWhoWeServeBanner = catchAsync(async (req, res) => {
  // extract banner data from request body
  const data = req.body;

  // delegate to service layer to create a new banner
  const response = await cmsService.createWhoWeServeBanner(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Who we serve banner created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing "Who We Serve" banner
 */
const updateWhoWeServeBanner = catchAsync(async (req, res) => {
  // get banner id from route parameters
  const { id } = req.params;
  // extract update data from request body
  const data = req.body;

  // delegate to service layer to update the banner
  const response = await cmsService.updateWhoWeServeBanner(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Who we serve banner updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a "Who We Serve" banner
 */
const deleteWhoWeServeBanner = catchAsync(async (req, res) => {
  // get banner id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete the banner
  const response = await cmsService.deleteWhoWeServeBanner(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Who we serve banner deleted successfully",
    data: response,
  });
});

// ====== Customer CTA ======

/**
 * Handler to get paginated Customer CTA (Call To Action) items
 */
const getPaginatedCustomerCta = catchAsync(async (req, res) => {
  // extract filter fields from the request query
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from the request query
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated Customer CTA data
  const response = await cmsService.getPaginatedCustomerCta(filters, options);

  // send response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Customers CTA fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new Customer CTA
 */
const createCustomerCta = catchAsync(async (req, res) => {
  // extract CTA data from request body
  const data = req.body;

  // delegate to service layer to create a new CTA
  const response = await cmsService.createCustomerCta(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Customer CTA created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing Customer CTA
 */
const updateCustomerCta = catchAsync(async (req, res) => {
  // get CTA id from route parameters
  const { id } = req.params;
  // extract data to update the CTA
  const data = req.body;

  // delegate to service layer to update the CTA
  const response = await cmsService.updateCustomerCta(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Customer CTA updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a Customer CTA
 */
const deleteCustomerCta = catchAsync(async (req, res) => {
  // get CTA id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete the CTA
  const response = await cmsService.deleteCustomerCta(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Customer CTA deleted successfully",
    data: response,
  });
});

// ====== Why Choose Us ======

/**
 * Handler to get paginated "Why Choose Us" entries
 */
const getPaginatedWhyChooseUs = catchAsync(async (req, res) => {
  // extract allowed filter parameters from query
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting values from query
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to get paginated "Why Choose Us" data
  const response = await cmsService.getPaginatedWhyChooseUs(filters, options);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Why choose us fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new "Why Choose Us" entry
 */
const createWhyChooseUs = catchAsync(async (req, res) => {
  // extract "Why Choose Us" data from request body
  const data = req.body;

  // delegate to service layer to create a new entry
  const response = await cmsService.createWhyChooseUs(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Why choose us created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing "Why Choose Us" entry
 */
const updateWhyChooseUs = catchAsync(async (req, res) => {
  // extract entry id from route parameters
  const { id } = req.params;
  // extract updated data from request body
  const data = req.body;

  // delegate to service layer to update entry
  const response = await cmsService.updateWhyChooseUs(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Why choose us updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a "Why Choose Us" entry
 */
const deleteWhyChooseUs = catchAsync(async (req, res) => {
  // extract entry id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete entry
  const response = await cmsService.deleteWhyChooseUs(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Why choose us deleted successfully",
    data: response,
  });
});

// ====== Limited Stocks ======

/**
 * Handler to get paginated limited stock items
 */
const getPaginatedLimitedStocks = catchAsync(async (req, res) => {
  // extract allowed filter parameters from query
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting parameters from query
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to get paginated limited stock data
  const response = await cmsService.getPaginatedLimitedStock(filters, options);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Limited stock fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new limited stock entry
 */
const createLimitedStock = catchAsync(async (req, res) => {
  // extract limited stock data from request body
  const data = req.body;

  // delegate to service layer to create limited stock
  const response = await cmsService.createLimitedStock(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Limited stock created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing limited stock entry
 */
const updateLimitedStock = catchAsync(async (req, res) => {
  // extract limited stock ID from route parameters
  const { id } = req.params;
  // extract updated data from request body
  const data = req.body;

  // delegate to service layer to update limited stock
  const response = await cmsService.updateLimitedStock(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Limited stock updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a limited stock entry
 */
const deleteLimitedStock = catchAsync(async (req, res) => {
  // extract limited stock ID from route parameters
  const { id } = req.params;

  // delegate to service layer to delete limited stock
  const response = await cmsService.deleteLimitedStock(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Limited stock deleted successfully",
    data: response,
  });
});

// ====== Certifications ======

/**
 * Handler to get paginated certifications
 */
const getPaginatedCertifications = catchAsync(async (req, res) => {
  // extract valid filter fields from query parameters
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from query parameters
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated certifications
  const response = await cmsService.getPaginatedCertifications(
    filters,
    options,
  );

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Certifications fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new certification
 */
const createCertification = catchAsync(async (req, res) => {
  // extract certification data from request body
  const data = req.body;

  // delegate to service layer to create certification
  const response = await cmsService.createCertification(data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Certification created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing certification
 */
const updateCertification = catchAsync(async (req, res) => {
  // extract certification id from route parameters
  const { id } = req.params;
  // extract update data from request body
  const data = req.body;

  // delegate to service layer to update certification
  const response = await cmsService.updateCertification(id, data);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Certification updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a certification
 */
const deleteCertification = catchAsync(async (req, res) => {
  // extract certification id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete certification
  const response = await cmsService.deleteCertification(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Certification deleted successfully",
    data: response,
  });
});

/// ====== Powered By ======

/**
 * Handler to get paginated "Powered By" entries
 */
const getPaginatedPoweredBy = catchAsync(async (req, res) => {
  // extract valid filter fields from query parameters
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract sorting and pagination options from query parameters
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated "Powered By" data
  const response = await cmsService.getPaginatedPoweredBy(filters, options);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Powered by fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new "Powered By" entry
 */
const createPoweredBy = catchAsync(async (req, res) => {
  // extract "Powered By" entry data from the request body
  const data = req.body;

  // delegate to service layer to create a new entry
  const response = await cmsService.createPoweredBy(data);

  // send response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Powered by created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing "Powered By" entry
 */
const updatePoweredBy = catchAsync(async (req, res) => {
  // extract entry ID from route parameters
  const { id } = req.params;
  // extract update data from request body
  const data = req.body;

  // delegate to service layer to update the entry
  const response = await cmsService.updatePoweredBy(id, data);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Powered by updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a "Powered By" entry
 */
const deletePoweredBy = catchAsync(async (req, res) => {
  // extract entry ID from route parameters
  const { id } = req.params;

  // delegate to service layer to delete the entry
  const response = await cmsService.deletePoweredBy(id);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Powered by deleted successfully",
    data: response,
  });
});

// ====== Vendor CTA ======

/**
 * Handler to get paginated Vendor CTA items
 */
const getPaginatedVendorCta = catchAsync(async (req, res) => {
  // extract filterable fields from query parameters
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from query parameters
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to fetch paginated Vendor CTA data
  const response = await cmsService.getPaginatedVenderCta(filters, options);

  // send response back to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor CTA fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new Vendor CTA
 */
const createVendorCta = catchAsync(async (req, res) => {
  // extract Vendor CTA data from the request body
  const data = req.body;

  // delegate to service layer to create Vendor CTA
  const response = await cmsService.createVendorCta(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor CTA created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing Vendor CTA
 */
const updateVendorCta = catchAsync(async (req, res) => {
  // extract Vendor CTA id from route parameters
  const { id } = req.params;
  // extract updated data from request body
  const data = req.body;

  // delegate to service layer to update Vendor CTA
  const response = await cmsService.updateVendorCta(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor CTA updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a Vendor CTA
 */
const deleteVendorCta = catchAsync(async (req, res) => {
  // extract Vendor CTA id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete Vendor CTA
  const response = await cmsService.deleteVendorCta(id);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor CTA deleted successfully",
    data: response,
  });
});

// ====== Sell Origin ======

/**
 * Handler to get paginated Sell Origin entries
 */
const getPaginatedSellOrigin = catchAsync(async (req, res) => {
  // extract allowed filter parameters from query
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from query
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to retrieve paginated Sell Origin entries
  const response = await cmsService.getPaginatedSellOrigin(filters, options);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Sell Origin fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new Sell Origin entry
 */
const createSellOrigin = catchAsync(async (req, res) => {
  // extract Sell Origin data from the request body
  const data = req.body;

  // delegate to service layer to create a new Sell Origin
  const response = await cmsService.createSellOrigin(data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Sell Origin created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing Sell Origin entry
 */
const updateSellOrigin = catchAsync(async (req, res) => {
  // extract id from route parameters
  const { id } = req.params;
  // extract updated data from request body
  const data = req.body;

  // delegate to service layer to update Sell Origin
  const response = await cmsService.updateSellOrigin(id, data);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Sell Origin updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a Sell Origin entry
 */
const deleteSellOrigin = catchAsync(async (req, res) => {
  // extract id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete Sell Origin
  const response = await cmsService.deleteSellOrigin(id);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Sell Origin deleted successfully",
    data: response,
  });
});

// ===== Facilities =====

/**
 * Handler to get paginated Facilities
 */
const getPaginatedFacilities = catchAsync(async (req, res) => {
  // extract filtering fields from query parameters
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  // extract pagination and sorting options from query parameters
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to get paginated facilities
  const response = await cmsService.getPaginatedFacilities(filters, options);

  // send success response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Facilities fetched successfully",
    data: response,
  });
});

/**
 * Handler to create a new facility
 */
const createFacility = catchAsync(async (req, res) => {
  // extract facility data from request body
  const data = req.body;

  // delegate to service layer to create a facility
  const response = await cmsService.createFacility(data);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Facility created successfully",
    data: response,
  });
});

/**
 * Handler to update an existing facility
 */
const updateFacility = catchAsync(async (req, res) => {
  // extract facility id from route parameters
  const { id } = req.params;
  // extract updated facility data from request body
  const data = req.body;

  // delegate to service layer to update the facility
  const response = await cmsService.updateFacility(id, data);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Facility updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a facility
 */
const deleteFacility = catchAsync(async (req, res) => {
  // extract facility id from route parameters
  const { id } = req.params;

  // delegate to service layer to delete the facility
  const response = await cmsService.deleteFacility(id);

  // send success response to the client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Facility deleted successfully",
    data: response,
  });
});

const cmsController = {
  getContent,
  updateContent,

  // Carousel Banner
  getPaginatedCarouselBanner,
  createCarouselBanner,
  updateCarouselBanner,
  deleteCarouselBanner,

  // Featured Banner
  getPaginatedFeaturedBanner,
  createFeaturedBanner,
  updateFeaturedBanner,
  deleteFeaturedBanner,

  // Who We Serve Banner
  getPaginatedWhoWeServeBanner,
  createWhoWeServeBanner,
  updateWhoWeServeBanner,
  deleteWhoWeServeBanner,

  // Customer CTA
  getPaginatedCustomerCta,
  createCustomerCta,
  updateCustomerCta,
  deleteCustomerCta,

  // Why Choose Us
  getPaginatedWhyChooseUs,
  createWhyChooseUs,
  updateWhyChooseUs,
  deleteWhyChooseUs,

  // Limited Stock
  getPaginatedLimitedStocks,
  createLimitedStock,
  updateLimitedStock,
  deleteLimitedStock,

  // Certification
  getPaginatedCertifications,
  createCertification,
  updateCertification,
  deleteCertification,

  // Powered By
  getPaginatedPoweredBy,
  createPoweredBy,
  updatePoweredBy,
  deletePoweredBy,

  // Vendor CTA
  getPaginatedVendorCta,
  createVendorCta,
  updateVendorCta,
  deleteVendorCta,

  // Sell origin
  getPaginatedSellOrigin,
  createSellOrigin,
  updateSellOrigin,
  deleteSellOrigin,

  // Facility
  getPaginatedFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
};
export default cmsController;
