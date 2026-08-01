import { z } from "zod";

const customImage = z.strictObject({
  url: z.string(),
  href: z.string().optional(),
  altText: z.string(),
});

const feature = z.strictObject({
  graphicUrl: z.string(),
  text: z.string(),
  subText: z.string(),
});

const text = z.strictObject({
  text: z.string(),
  subText: z.string(),
});

const featureProducts = z.strictObject({
  carousel1: z.array(customImage),
  carousel2: z.array(customImage),
  image1: customImage,
  image2: customImage,
});

// zod schema for update cms api
const updateCmsSchema = z.object({
  body: z.strictObject({
    promotionalBanners: z.array(customImage),
    certifications: z.array(customImage),
    poweredBy: z.array(customImage),
    limitedStockBanners: z.array(customImage),
    ourFeatures: z.array(feature),
    whoWeServe: z.array(feature),
    whyChooseUs: z.array(feature),
    featuredProducts: featureProducts,
    whyChooseUsBannerUrl: z.string().url(),
    whyChooseUsHeading: text,
    customerSignupCtaBannerUrl: z.string().url(),
    vendorSignupCtaBannerUrl: z.string().url(),
  }),
});

// zod schema for create carousel banner api
const createCarouselBannerSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    media: z.array(customImage),
    active: z.boolean(),
  }),
});

// zod schema for update carousel banner api
const updateCarouselBannerSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    media: z.array(customImage).optional(),
    contentId: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

// zod schema for create featured banner api
const createFeaturedBannerSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    squareCarousel: z.array(customImage),
    horizontalCarousel: z.array(customImage),
    staticImage1: customImage,
    staticImage2: customImage,
    active: z.boolean(),
  }),
});

// zod schema for update featured banner api
const updateFeaturedBannerSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    squareCarousel: z.array(customImage).optional(),
    horizontalCarousel: z.array(customImage).optional(),
    staticImage1: customImage.optional(),
    staticImage2: customImage.optional(),
    contentId: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

// zod schema for create who we serve api
const createWhoWeServeBannerSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    features: z.array(feature),
    active: z.boolean(),
  }),
});

// zod schema for update who we serve api
const updateWhoWeServeBannerSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    features: z.array(feature).optional(),
    contentId: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

// zod schema for create customer cta api
const createCustomerCtaSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required
    media: feature,
  }),
});

// zod schema for update customer cta api
const updateCustomerCtaSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional
    media: feature.optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create why choose us api
const createWhyChooseUsSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(),
    staticImage: customImage,
    cards: z.array(feature),
    heading: text,
  }),
});

// zod schema for update why choose us api
const updateWhyChooseUsSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional in update
    staticImage: customImage.optional(),
    cards: z.array(feature).optional(),
    contentId: z.string().optional(),
    heading: text.optional(),
  }),
});

// zod schema for create limited stock api
const createLimitedStockSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required
    media: z.array(customImage),
  }),
});
// zod schema for update limited stock api
const updateLimitedStockSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional
    media: z.array(customImage).optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create certification api
const createCertificationFeatureSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required in create
    media: customImage,
  }),
});

// zod schema for update certification api
const updateCertificationFeatureSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional in update
    media: customImage.optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create powered by api
const createPoweredBySchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required
    media: customImage,
  }),
});

// zod schema for update powered by api
const updatePoweredBySchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional
    media: customImage.optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create vendor cta by api
const createVendorCtaSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required in create
    media: customImage,
  }),
});

// zod schema for update vendor cta by api
const updateVendorCtaSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional in update
    media: customImage.optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create sell origin by api
const createSellOriginSchema = z.object({
  body: z.strictObject({
    title: z.string(),
    active: z.boolean(), // ✅ Required in create
    media: customImage,
  }),
});

// zod schema for update sell origin by api
const updateSellOriginSchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional in update
    media: customImage.optional(),
    contentId: z.string().optional(),
  }),
});

// zod schema for create facility by api
const createFacilitySchema = z.object({
  body: z.strictObject({
    title: z.string(),
    description: z.string(),
    active: z.boolean(), // ✅ Required in create
    media: customImage,
  }),
});
// zod schema for update facility by api
const updateFacilitySchema = z.object({
  body: z.strictObject({
    title: z.string().optional(),
    description: z.string().optional(),
    active: z.boolean().optional(), // ✅ Optional in update
    media: customImage.optional(),
    contentId: z.string().optional(),
  }),
});

const cmsValidator = {
  updateCmsSchema,
  createCarouselBannerSchema,
  updateCarouselBannerSchema,

  createFeaturedBannerSchema,
  updateFeaturedBannerSchema,

  createWhoWeServeBannerSchema,
  updateWhoWeServeBannerSchema,

  // Customer CTA
  createCustomerCtaSchema,
  updateCustomerCtaSchema,

  // Why Choose Us
  createWhyChooseUsSchema,
  updateWhyChooseUsSchema,

  // Limited Stock
  createLimitedStockSchema,
  updateLimitedStockSchema,

  // Certifications
  createCertificationFeatureSchema,
  updateCertificationFeatureSchema,

  // Powered By
  createPoweredBySchema,
  updatePoweredBySchema,

  // Vendor CTA
  createVendorCtaSchema,
  updateVendorCtaSchema,

  // Sell origin
  createSellOriginSchema,
  updateSellOriginSchema,

  // Facility
  createFacilitySchema,
  updateFacilitySchema,
};
export default cmsValidator;
