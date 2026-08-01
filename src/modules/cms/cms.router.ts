import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import cmsController from "./cms.controller";
import cmsValidator from "./cms.validator";

// ===== CMS Routes =====
const cmsRouter = Router();

// get full CMS content api
cmsRouter.route("/").get(cmsController.getContent);

// update CMS content api
cmsRouter
  .route("/")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    cmsController.updateContent,
  );

// ===== Carousel Banner =====
// get carousel banners api and create carousel banner api
cmsRouter
  .route("/carousel")
  .get(cmsController.getPaginatedCarouselBanner)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createCarouselBannerSchema),
    cmsController.createCarouselBanner,
  );

// update carousel banner api and delete carousel banner api
cmsRouter
  .route("/carousel/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateCarouselBannerSchema),
    cmsController.updateCarouselBanner,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteCarouselBanner,
  );

// ===== Featured Banner =====
// get featured banners api and create featured banner api
cmsRouter
  .route("/featured")
  .get(cmsController.getPaginatedFeaturedBanner)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createFeaturedBannerSchema),
    cmsController.createFeaturedBanner,
  );

// update featured banner api and delete featured banner api
cmsRouter
  .route("/featured/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateFeaturedBannerSchema),
    cmsController.updateFeaturedBanner,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteFeaturedBanner,
  );

// ===== Who We Serve Banner =====
// get who we serve banners api and create who we serve banner api
cmsRouter
  .route("/serve")
  .get(cmsController.getPaginatedWhoWeServeBanner)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createWhoWeServeBannerSchema),
    cmsController.createWhoWeServeBanner,
  );

// update who we serve banner api and delete who we serve banner api
cmsRouter
  .route("/serve/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateWhoWeServeBannerSchema),
    cmsController.updateWhoWeServeBanner,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteWhoWeServeBanner,
  );

// ===== Customer CTA =====
// get customer cta api and create customer cta api
cmsRouter
  .route("/customerCta")
  .get(cmsController.getPaginatedCustomerCta)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createCustomerCtaSchema),
    cmsController.createCustomerCta,
  );

// update customer cta api and delete customer cta api
cmsRouter
  .route("/customerCta/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateCustomerCtaSchema),
    cmsController.updateCustomerCta,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteCustomerCta,
  );

// ===== Why Choose Us =====
// get why choose us api and create why choose us api
cmsRouter
  .route("/whyChooseUs")
  .get(cmsController.getPaginatedWhyChooseUs)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createWhyChooseUsSchema),
    cmsController.createWhyChooseUs,
  );

// update why choose us api and delete why choose us api
cmsRouter
  .route("/whyChooseUs/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateWhyChooseUsSchema),
    cmsController.updateWhyChooseUs,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteWhyChooseUs,
  );

// ===== Limited Stock =====
// get limited stock api and create limited stock api
cmsRouter
  .route("/limitedStock")
  .get(cmsController.getPaginatedLimitedStocks)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createLimitedStockSchema),
    cmsController.createLimitedStock,
  );

// update limited stock api and delete limited stock api
cmsRouter
  .route("/limitedStock/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateLimitedStockSchema),
    cmsController.updateLimitedStock,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteLimitedStock,
  );

// ===== Certifications =====
// get certifications api and create certification api
cmsRouter
  .route("/certification")
  .get(cmsController.getPaginatedCertifications)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createCertificationFeatureSchema),
    cmsController.createCertification,
  );

// update certification api and delete certification api
cmsRouter
  .route("/certification/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateCertificationFeatureSchema),
    cmsController.updateCertification,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteCertification,
  );

// ===== Powered By =====
// get powered by api and create powered by api
cmsRouter
  .route("/poweredBy")
  .get(cmsController.getPaginatedPoweredBy)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createPoweredBySchema),
    cmsController.createPoweredBy,
  );

// update powered by api and delete powered by api
cmsRouter
  .route("/poweredBy/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updatePoweredBySchema),
    cmsController.updatePoweredBy,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deletePoweredBy,
  );

// ===== Vendor CTA =====
// get vendor cta api and create vendor cta api
cmsRouter
  .route("/vendorCta")
  .get(cmsController.getPaginatedVendorCta)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createVendorCtaSchema),
    cmsController.createVendorCta,
  );

// update vendor cta api and delete vendor cta api
cmsRouter
  .route("/vendorCta/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateVendorCtaSchema),
    cmsController.updateVendorCta,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteVendorCta,
  );

// ===== Sell Origin =====
// get sell origin api and create sell origin api
cmsRouter
  .route("/sellOrigin")
  .get(cmsController.getPaginatedSellOrigin)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createSellOriginSchema),
    cmsController.createSellOrigin,
  );

// update sell origin api and delete sell origin api
cmsRouter
  .route("/sellOrigin/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateSellOriginSchema),
    cmsController.updateSellOrigin,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteSellOrigin,
  );

// ===== Facility =====
// get facility api and create facility api
cmsRouter
  .route("/facility")
  .get(cmsController.getPaginatedSellOrigin)
  .post(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.createSellOriginSchema),
    cmsController.createSellOrigin,
  );

// update facility api and delete facility api
cmsRouter
  .route("/facility/:id")
  .patch(
    handleAuth(),
    checkPermission(["BANNERS"], "WRITE"),
    validateRequest(cmsValidator.updateSellOriginSchema),
    cmsController.updateSellOrigin,
  )
  .delete(
    handleAuth(),
    checkPermission(["BANNERS"], "DELETE"),
    cmsController.deleteSellOrigin,
  );

export default cmsRouter;
