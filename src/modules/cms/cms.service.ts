import prisma from "@/config/prisma";
import {
  BannerCarousel,
  CertificationFeature,
  CustomerCta,
  Facility,
  FeaturedBanner,
  LimitedStock,
  PoweredBy,
  Prisma,
  SellOrigin,
  VendorCta,
  WhoWeServe,
  WhyChooseUs,
} from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { status as httpStatus } from "http-status";

/**
 * Fetch CMS content with only active related sections
 * @returns content with active banners, CTAs, and other related entities
 */
const getContent = async () => {
  // fetch the first CMS content record and include only active fields from related entities
  return prisma.content.findFirst({
    include: {
      bannerCarousel: { where: { active: true } },
      certifications: { where: { active: true } },
      customerCtas: { where: { active: true } },
      featuredBanners: { where: { active: true } },
      limitedStock: { where: { active: true } },
      sellOrigin: { where: { active: true } },
      vendorCtas: { where: { active: true } },
      whoWeServe: { where: { active: true } },
      whyChooseUs: { where: { active: true } },
    },
  });
};

/**
 * Ensure CMS content exists — returns the existing one or creates a new empty record
 * @returns existing content or newly created content record
 */
const updateContent = async () => {
  // check if a CMS content record already exists
  const content = await prisma.content.findFirst();

  // if exists, return it; otherwise create a new empty content record
  return content ?? prisma.content.create({ data: {} });
};

// ====== Carousel Banner ======
/**
 * Get paginated list of carousel banners with filters, search, sorting, and pagination
 */
const getPaginatedCarouselBanner = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<BannerCarousel>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filter values
  const { search, isAdmin, active, ...filterData } = filters;

  // store conditions dynamically for Prisma query
  const conditions: Prisma.BannerCarouselWhereInput[] = [];

  // partial text search (name contains...)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active status filter (admin can see all if specified)
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // for non-admin users, only show active banners
    conditions.push({ active: true });
  }

  // exact match for remaining fields (e.g., id, type, etc.)
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions using AND if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch paginated results and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.bannerCarousel.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.bannerCarousel.count({ where: whereConditions }),
  ]);

  // return formatted paginated response
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new carousel banner
 * @param data - banner data to be created
 * @returns the newly created carousel banner
 */
const createCarouselBanner = async (data: BannerCarousel) => {
  // check if CMS main content exists, as banner must be linked to it
  const content = await prisma.content.findFirst();
  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // create banner inside a database transaction
  return prisma.$transaction(async (tx) => {
    // if this banner is marked as active, deactivate all other banners
    if (data.active) {
      await tx.bannerCarousel.updateMany({ data: { active: false } });
    }

    // create new banner linked to CMS content
    return tx.bannerCarousel.create({
      data: { ...data, contentId: content.id },
    });
  });
};

/**
 * Update an existing carousel banner
 * @param id - id of the banner to update
 * @param data - fields to be updated
 * @returns the updated banner
 */
const updateCarouselBanner = async (
  id: string,
  data: Partial<BannerCarousel>,
) => {
  // check if the banner exists
  const banner = await prisma.bannerCarousel.findUnique({ where: { id } });
  if (!banner) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // run update logic in a database transaction
  return prisma.$transaction(async (tx) => {
    // if updating to active, deactivate all other active banners for the same content
    if (data.active) {
      await tx.bannerCarousel.updateMany({
        where: { contentId: banner?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the current banner
    return tx.bannerCarousel.update({
      where: { id: banner.id },
      data: { ...data },
    });
  });
};

/**
 * Delete a carousel banner by its id
 * @param id - id of the banner to delete
 * @returns the deleted banner record
 */
const deleteCarouselBanner = async (id: string) => {
  // delete the banner from the database
  return prisma.bannerCarousel.delete({ where: { id } });
};

// ====== Featured Banner ======
/**
 * Get paginated list of featured banners with filters, search, sorting, and pagination
 */
const getPaginatedFeaturedBanner = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<FeaturedBanner>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting options
  const {
    limit: take,
    skip,
    page,
    sortOrder,
    sortBy,
  } = calculatePagination(options);
  // extract filter values
  const { search, isAdmin, active, ...filterData } = filters;

  // store dynamic conditions for Prisma query
  const conditions: Prisma.FeaturedBannerWhereInput[] = [];

  // partial text search for banner name
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive filter logic
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admin users get only active banners
    conditions.push({ active: true });
  }
  // exact field match for remaining filters
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions using AND if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch data and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.featuredBanner.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.featuredBanner.count({ where: whereConditions }),
  ]);
  // return structured paginated response
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new featured banner
 * @param data - data for creating a featured banner
 * @returns newly created featured banner
 */
const createFeaturedBanner = async (data: FeaturedBanner) => {
  // ensure content exists because banner must be linked to content
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // use transaction to handle active status logic and banner creation
  return prisma.$transaction(async (tx) => {
    // if new banner is marked active, deactivate all existing active featured banners
    if (data.active) {
      await tx.featuredBanner.updateMany({ data: { active: false } });
    }

    // create and link featured banner with content
    return tx.featuredBanner.create({
      data: { ...data, contentId: content.id },
    });
  });
};

/**
 * Update an existing featured banner
 * @param id - ID of the banner to update
 * @param data - data to update in the banner
 * @returns updated banner
 */
const updateFeaturedBanner = async (
  id: string,
  data: Partial<FeaturedBanner>,
) => {
  // check if the banner exists
  const banner = await prisma.featuredBanner.findUnique({ where: { id } });

  if (!banner) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // run transactional update to ensure consistency
  return prisma.$transaction(async (tx) => {
    // if updating to active, deactivate all other active banners under the same content
    if (data.active) {
      await tx.featuredBanner.updateMany({
        where: { contentId: banner?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the target banner with new data
    return tx.featuredBanner.update({
      where: { id: banner.id },
      data,
    });
  });
};

/**
 * Delete a featured banner by its ID
 * @param id - ID of the featured banner to delete
 * @returns deleted banner record
 */
const deleteFeaturedBanner = async (id: string) => {
  // delete banner from database
  return prisma.featuredBanner.delete({ where: { id } });
};

// ====== Who We Serve Banner ======

/**
 * Get paginated list of "Who We Serve" banners with filtering, searching, and sorting
 */
const getPaginatedWhoWeServeBanner = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filter parameters
  const { search, isAdmin, active, ...filterData } = filters;

  // build dynamic filtering conditions
  const conditions: Prisma.WhoWeServeWhereInput[] = [];

  // partial match for name field
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive filtering
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admin users can only view active banners
    conditions.push({ active: true });
  }

  // exact match for other filter fields (e.g., id, type)
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions using AND (only if any conditions exist)
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch data and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.whoWeServe.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.whoWeServe.count({ where: whereConditions }),
  ]);

  // return response in standard format
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new "Who We Serve" banner
 * @param data - banner details to be created
 * @returns newly created banner
 */
const createWhoWeServeBanner = async (data: WhoWeServe) => {
  // Ensure content record exists before associating banner with it
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }
  // Use a transaction to ensure data consistency
  return prisma.$transaction(async (tx) => {
    // If this banner is marked active, deactivate all others first
    if (data.active) {
      await tx.whoWeServe.updateMany({ data: { active: false } });
    }
    // Create the new banner and link it with content
    return tx.whoWeServe.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update a "Who We Serve" banner
 * @param id - ID of the banner to update
 * @param data - updated banner fields
 * @returns updated banner record
 */
const updateWhoWeServeBanner = async (
  id: string,
  data: Partial<WhoWeServe>,
) => {
  // check if the banner exists in the database
  const banner = await prisma.whoWeServe.findUnique({ where: { id } });
  if (!banner) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // use transaction to handle active status update safely
  return prisma.$transaction(async (tx) => {
    // if marking this banner as active, deactivate all others under same content
    if (data.active) {
      await tx.whoWeServe.updateMany({
        where: { contentId: banner?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the current banner
    return tx.whoWeServe.update({
      where: { id: banner.id },
      data,
    });
  });
};

/**
 * Delete a "Who We Serve" banner by its ID
 * @param id - ID of the banner to delete
 * @returns deleted banner record
 */
const deleteWhoWeServeBanner = async (id: string) => {
  // delete the banner from the database
  return prisma.whoWeServe.delete({ where: { id } });
};

// ====== Customer CTA ======

/**
 * Get paginated list of Customer CTA items with support for
 * search, filters, sorting, and pagination
 */
const getPaginatedCustomerCta = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting options
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filter values
  const { search, isAdmin, active, ...filterData } = filters;

  // array to collect Prisma WHERE conditions dynamically
  const conditions: Prisma.CustomerCtaWhereInput[] = [];

  // partial match (search by name)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive filter
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admin users only see active records
    conditions.push({ active: true });
  }

  // exact match for additional fields
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions under AND clause if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch data and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.customerCta.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.customerCta.count({ where: whereConditions }),
  ]);

  // return formatted result with metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new Customer CTA
 * @param data - Customer CTA data to be created
 * @returns newly created Customer CTA
 */
const createCustomerCta = async (data: CustomerCta) => {
  // ensure CMS content exists before linking CTA to it
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }
  // execute operations in a transaction to maintain data integrity
  return prisma.$transaction(async (tx) => {
    // if the new CTA is active, deactivate any existing active CTAs
    if (data.active) {
      await tx.customerCta.updateMany({ data: { active: false } });
    }

    // create a new CTA linked to CMS content
    return tx.customerCta.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing Customer CTA
 * @param id - ID of the Customer CTA to update
 * @param data - fields to be updated
 * @returns updated Customer CTA
 */
const updateCustomerCta = async (id: string, data: Partial<CustomerCta>) => {
  // check if the CTA exists
  const customerCta = await prisma.customerCta.findUnique({ where: { id } });
  if (!customerCta) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // run inside a transaction to keep consistency
  return prisma.$transaction(async (tx) => {
    // if this CTA is being set to active, deactivate other active CTAs
    if (data.active) {
      await tx.customerCta.updateMany({
        where: { contentId: customerCta?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the selected CTA
    return tx.customerCta.update({
      where: { id: customerCta.id },
      data,
    });
  });
};

/**
 * Delete a Customer CTA by its ID
 * @param id - ID of the Customer CTA to delete
 * @returns deleted CTA record
 */
const deleteCustomerCta = async (id: string) => {
  // delete CTA from database
  return prisma.customerCta.delete({ where: { id } });
};

// ====== Why Choose Us ======
/**
 * Get paginated list of "Why Choose Us" items with filters, search, sorting, and pagination
 */
const getPaginatedWhyChooseUs = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract individual filter values
  const { search, isAdmin, active, ...filterData } = filters;

  // store where conditions dynamically for Prisma
  const conditions: Prisma.WhyChooseUsWhereInput[] = [];

  // partial match for search (by name)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive logic
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admin users only see active records
    conditions.push({ active: true });
  }

  // exact match filters for other fields
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all WHERE conditions if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch records and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.whyChooseUs.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.whyChooseUs.count({ where: whereConditions }),
  ]);

  // return response with pagination metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new "Why Choose Us" item
 * @param data - data for creating a new WhyChooseUs item
 * @returns newly created WhyChooseUs record
 */
const createWhyChooseUs = async (data: WhyChooseUs) => {
  // ensure CMS content exists to associate this item
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // run inside a transaction to maintain consistency
  return prisma.$transaction(async (tx) => {
    // if the new item is active, deactivate all other items first
    if (data.active) {
      await tx.whyChooseUs.updateMany({ data: { active: false } });
    }

    // create new item and link it to the CMS content
    return tx.whyChooseUs.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing "Why Choose Us" item
 * @param id - ID of the WhyChooseUs item to update
 * @param data - fields to update
 * @returns updated WhyChooseUs record
 */
const updateWhyChooseUs = async (id: string, data: Partial<WhyChooseUs>) => {
  // check if the item exists
  const whyChooseUs = await prisma.whyChooseUs.findUnique({ where: { id } });
  if (!whyChooseUs) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }
  // perform update in a transaction to maintain data consistency
  return prisma.$transaction(async (tx) => {
    // if this item is being set as active, deactivate all other active ones
    if (data.active) {
      await tx.whyChooseUs.updateMany({
        where: { contentId: whyChooseUs?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the target item with new data
    return tx.whyChooseUs.update({
      where: { id: whyChooseUs.id },
      data,
    });
  });
};
/**
 * Delete a "Why Choose Us" item by its ID
 * @param id - ID of the WhyChooseUs item to delete
 * @returns deleted record
 */
const deleteWhyChooseUs = async (id: string) => {
  // delete the record from the database
  return prisma.whyChooseUs.delete({ where: { id } });
};

// ====== Limited Stock ======

/**
 * Get paginated Limited Stock items with filters, search, sorting, and pagination
 */
const getPaginatedLimitedStock = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting data
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract query filters
  const { search, isAdmin, active, ...filterData } = filters;

  // array to store dynamic where conditions
  const conditions: Prisma.LimitedStockWhereInput[] = [];

  // partial search by name
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive filter logic
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // if user is not admin, show only active items
    conditions.push({ active: true });
  }

  // exact filters for any additional fields
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions under AND if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch filtered data + total count in parallel
  const [result, total] = await Promise.all([
    await prisma.limitedStock.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.limitedStock.count({ where: whereConditions }),
  ]);

  // return data along with pagination metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};
/**
 * Create a new Limited Stock banner
 * @param data - LimitedStock data to be created
 * @returns newly created LimitedStock record
 */
const createLimitedStock = async (data: LimitedStock) => {
  // fetch CMS content to link the banner to it
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // content must exist before creating a banner
  return prisma.$transaction(async (tx) => {
    // If the new banner is active, deactivate all existing active banners
    if (data.active) {
      await tx.limitedStock.updateMany({ data: { active: false } });
    }
    // create the new limited stock banner linked with content
    return tx.limitedStock.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing Limited Stock banner
 * @param id - ID of the LimitedStock entry to update
 * @param data - Fields to update in the LimitedStock entry
 * @returns updated LimitedStock record
 */
const updateLimitedStock = async (id: string, data: Partial<LimitedStock>) => {
  // check if the banner exists
  const whyChooseUs = await prisma.limitedStock.findUnique({ where: { id } });
  if (!whyChooseUs) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // run transaction for safe update
  return prisma.$transaction(async (tx) => {
    // if marking this as active, deactivate all previously active banners
    if (data.active) {
      await tx.limitedStock.updateMany({
        where: { contentId: whyChooseUs?.contentId, active: true },
        data: { active: false },
      });
    }

    // update the current limited stock entry
    return tx.limitedStock.update({
      where: { id: whyChooseUs.id },
      data,
    });
  });
};

/**
 * Delete a Limited Stock banner by its ID
 * @param id - ID of the LimitedStock record to delete
 * @returns deleted LimitedStock record
 */
const deleteLimitedStock = async (id: string) => {
  // delete the specified limited stock record
  return prisma.limitedStock.delete({ where: { id } });
};

// ====== Certifications ======

/**
 * Get paginated Certifications with filtering, searching, sorting, and pagination support
 */
const getPaginatedCertifications = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filtering values
  const { search, isAdmin, active, ...filterData } = filters;

  // dynamic array to store Prisma where conditions
  const conditions: Prisma.CertificationFeatureWhereInput[] = [];

  // partial match for 'name' field (search functionality)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }
  // active/inactive filter logic
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admins should only see active records
    conditions.push({ active: true });
  }

  // exact match for additional filters (e.g., id, etc.)
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // merge all conditions under AND if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch filtered certifications + total count in parallel
  const [result, total] = await Promise.all([
    await prisma.certificationFeature.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.certificationFeature.count({ where: whereConditions }),
  ]);

  // return structured response with data & pagination info
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new Certification
 * - Ensures CMS content exists before creation
 * - If certification is marked active, ensures max 5 active certifications are allowed
 */
const createCertification = async (data: CertificationFeature) => {
  // check if content exists to associate certification
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // use a transaction to maintain data consistency
  return prisma.$transaction(async (tx) => {
    // if new certification is active, ensure active limit doesn't exceed 5
    if (data.active) {
      const totalActive = await tx.certificationFeature.findMany({
        where: { active: true },
      });

      if (totalActive.length >= 5) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only five certificate is active at a time",
        );
      }
    }

    // create new certification with linked content
    return tx.certificationFeature.create({
      data: { ...data, contentId: content.id },
    });
  });
};

/**
 * Update an existing Certification
 * - Prevents more than 5 active certifications
 * @param id - Certification ID
 * @param data - Partial certification data to update
 */
const updateCertification = async (
  id: string,
  data: Partial<CertificationFeature>,
) => {
  // check if certification exists
  const certification = await prisma.certificationFeature.findUnique({
    where: { id },
  });
  if (!certification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // perform update via transaction
  return prisma.$transaction(async (tx) => {
    // restrict active certifications to maximum 5
    if (data.active) {
      const totalActive = await tx.certificationFeature.findMany({
        where: { active: true },
      });

      if (totalActive.length >= 5) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only five certificate is active at a time",
        );
      }
    }

    // update certification
    return tx.certificationFeature.update({
      where: { id: certification.id },
      data,
    });
  });
};

/**
 * Delete a certification by its ID
 * @param id - ID of the certification to delete
 * @returns deleted certification record
 */
const deleteCertification = async (id: string) => {
  // remove the certification from the database
  return prisma.certificationFeature.delete({ where: { id } });
};

// ====== Powered By ======

/**
 * Get paginated list of "Powered By" items with searching, filtering,
 * sorting, and pagination support.
 */
const getPaginatedPoweredBy = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting details
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filtering options
  const { search, isAdmin, active, ...filterData } = filters;

  // array to store dynamic Prisma where conditions
  const conditions: Prisma.PoweredByWhereInput[] = [];

  // partial search filter (search by name)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive filter
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // default behavior for non-admins: show only active records
    conditions.push({ active: true });
  }

  // exact match for additional filters (like id or other fields)
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine all conditions into a Prisma WHERE object
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch data and total count in parallel
  const [result, total] = await Promise.all([
    await prisma.poweredBy.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.poweredBy.count({ where: whereConditions }),
  ]);

  // return paginated structure with meta info
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new "Powered By" entry
 * - Ensures content exists before creation
 * - Limits active entries to a maximum of 6 at any time
 * @param data - PoweredBy entry data
 */
const createPoweredBy = async (data: PoweredBy) => {
  // fetch content to associate the PoweredBy entry
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // if no content exists, prompt to create/update it first
  return prisma.$transaction(async (tx) => {
    // if this entry is set as active, ensure max active entries do not exceed 6
    if (data.active) {
      const totalActive = await tx.poweredBy.findMany({
        where: { active: true },
      });

      if (totalActive.length >= 6) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only 6 powered by can be active at a time",
        );
      }
    }
    // create new PoweredBy entry linked to content
    return tx.poweredBy.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing "Powered By" entry
 * - Ensures the entry exists before updating
 * - If setting as active, ensures no more than 6 active records exist
 * @param id - ID of the PoweredBy entry to update
 * @param data - Partial update data
 * @returns updated PoweredBy record
 */
const updatePoweredBy = async (id: string, data: Partial<PoweredBy>) => {
  // check if the powered by entry exists
  const poweredBy = await prisma.poweredBy.findUnique({ where: { id } });
  if (!poweredBy) {
    throw new ApiError(httpStatus.NOT_FOUND, "Powered by not found");
  }

  // perform update within a transaction to maintain consistency
  return prisma.$transaction(async (tx) => {
    // if marking this entry as active, ensure maximum 6 active records rule is not violated
    if (data.active) {
      const totalActive = await tx.poweredBy.findMany({
        where: { active: true },
      });

      if (totalActive.length >= 6) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only six powered by can be active at a time",
        );
      }
    }

    // update the existing PoweredBy record
    return tx.poweredBy.update({
      where: { id: poweredBy.id },
      data,
    });
  });
};

/**
 * Delete a "Powered By" entry by its ID
 * @param id - ID of the PoweredBy record to delete
 * @returns deleted PoweredBy record
 */
const deletePoweredBy = async (id: string) => {
  // delete the PoweredBy record from the database
  return prisma.poweredBy.delete({ where: { id } });
};

// ====== Vendor CTA ======

/**
 * Get paginated Vendor CTA records with filtering, searching, sorting, and pagination
 */
const getPaginatedVenderCta = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting options
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filters from query params
  const { search, isAdmin, active, ...filterData } = filters;

  // store Prisma conditions dynamically
  const conditions: Prisma.VendorCtaWhereInput[] = [];

  // partial text search by name
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // active/inactive state filter
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admin users only see active data
    conditions.push({ active: true });
  }

  // exact match for remaining filter fields
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // merge all conditions into a Prisma WHERE object
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // execute query and count in parallel
  const [result, total] = await Promise.all([
    await prisma.vendorCta.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.vendorCta.count({ where: whereConditions }),
  ]);

  // return formatted paginated response
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new Vendor CTA
 * @param data - Vendor CTA data to be created
 * @returns newly created Vendor CTA record
 */
const createVendorCta = async (data: VendorCta) => {
  // ensure content exists to associate the Vendor CTA with it
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // use a transaction to maintain atomicity and consistency
  return prisma.$transaction(async (tx) => {
    // if the new CTA is active, deactivate all existing active Vendor CTAs
    if (data.active) {
      await tx.vendorCta.updateMany({ data: { active: false } });
    }

    // create the new Vendor CTA record linked to content
    return tx.vendorCta.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing Vendor CTA
 * @param id - ID of the Vendor CTA to update
 * @param data - Partial fields to update
 * @returns updated Vendor CTA record
 */
const updateVendorCta = async (id: string, data: Partial<VendorCta>) => {
  // check if the Vendor CTA exists
  const vendorCta = await prisma.vendorCta.findUnique({ where: { id } });
  if (!vendorCta) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }
  // run update logic in a transaction to maintain atomicity
  return prisma.$transaction(async (tx) => {
    // if setting this CTA to active, deactivate all other active CTAs first
    if (data.active) {
      await tx.vendorCta.updateMany({
        where: { contentId: vendorCta?.contentId, active: true },
        data: { active: false },
      });
    }
    // update this specific Vendor CTA
    return tx.vendorCta.update({
      where: { id: vendorCta.id },
      data,
    });
  });
};

/**
 * Delete a Vendor CTA by its ID
 * @param id - ID of the Vendor CTA to delete
 * @returns deleted Vendor CTA record
 */
const deleteVendorCta = async (id: string) => {
  // remove the Vendor CTA from the database
  return prisma.vendorCta.delete({ where: { id } });
};

// ====== Sell Origin ======

/**
 * Get paginated Sell Origin records with search, filter, sorting, and pagination
 */
const getPaginatedSellOrigin = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting parameters
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // extract filter fields
  const { search, isAdmin, active, ...filterData } = filters;

  // array to build dynamic filter conditions
  const conditions: Prisma.SellOriginWhereInput[] = [];

  // search by partial match (case-insensitive name search)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // filter active/inactive items
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // non-admins should only see active records
    conditions.push({ active: true });
  }

  // exact match for additional filter fields
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // combine filter conditions using AND
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // fetch matching records + total count in parallel
  const [result, total] = await Promise.all([
    await prisma.sellOrigin.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.sellOrigin.count({ where: whereConditions }),
  ]);

  // return data and pagination metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new Sell Origin entry
 * @param data - SellOrigin data to create
 * @returns newly created SellOrigin record
 */
const createSellOrigin = async (data: SellOrigin) => {
  // Ensure that main content exists before linking Sell Origin
  const content = await prisma.content.findFirst();

  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // Use transaction to keep operations consistent
  return prisma.$transaction(async (tx) => {
    if (data.active) {
      await tx.sellOrigin.updateMany({ data: { active: false } });
    }

    // If this entry is active, deactivate all other active Sell Origin entries
    return tx.sellOrigin.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing Sell Origin entry
 * @param id - ID of the SellOrigin entry
 * @param data - Fields to update
 * @returns updated SellOrigin record
 */
const updateSellOrigin = async (id: string, data: Partial<SellOrigin>) => {
  // Check if SellOrigin entry exists
  const sellOrigin = await prisma.sellOrigin.findUnique({ where: { id } });
  if (!sellOrigin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Banner not found");
  }

  // Execute update in a transaction to maintain consistency
  return prisma.$transaction(async (tx) => {
    // If setting this entry to active, first deactivate existing active ones
    if (data.active) {
      await tx.sellOrigin.updateMany({
        where: { contentId: sellOrigin?.contentId, active: true },
        data: { active: false },
      });
    }
    // Update the selected SellOrigin entry
    return tx.sellOrigin.update({
      where: { id: sellOrigin.id },
      data,
    });
  });
};
/**
 * Delete a Sell Origin entry by its ID
 * @param id - ID of the SellOrigin record to delete
 * @returns deleted SellOrigin record
 */
const deleteSellOrigin = async (id: string) => {
  // Remove the SellOrigin record from the database
  return prisma.sellOrigin.delete({ where: { id } });
};

// ========== Facilities ==========

/**
 * Get paginated Facilities with filters, search, sorting, and pagination
 */
const getPaginatedFacilities = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<WhoWeServe>,
  options: PaginationOptions,
) => {
  // Extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // Destructure filtering inputs
  const { search, isAdmin, active, ...filterData } = filters;

  // Array to store Prisma where conditions
  const conditions: Prisma.FacilityWhereInput[] = [];

  // Partial match search (name field, case-insensitive)
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  // Filter by active/inactive
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    // Non-admins only get active facilities
    conditions.push({ active: true });
  }

  // Exact match for additional filters
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // Combine conditions if any exist
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // Fetch facilities and total count concurrently
  const [result, total] = await Promise.all([
    await prisma.facility.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.facility.count({ where: whereConditions }),
  ]);

  // Return data with pagination metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Create a new Facility entry
 * - Ensures content exists before associating a facility
 * - Restricts the number of active facilities to a maximum of 4
 * @param data - Facility data to be created
 * @returns newly created Facility record
 */
const createFacility = async (data: Facility) => {
  // Fetch associated CMS content
  const content = await prisma.content.findFirst();

  // Throw error if content doesn't exist
  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please update content first");
  }

  // Execute within a transaction to maintain consistency
  return prisma.$transaction(async (tx) => {
    // If the new facility is marked active, ensure active count doesn't exceed 4
    if (data.active) {
      const facility = await tx.facility.findMany({
        where: { active: true },
      });

      if (facility.length >= 4) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only 4 facility can be active at a time",
        );
      }
    }

    // Create the facility and link it to the content
    return tx.facility.create({ data: { ...data, contentId: content.id } });
  });
};

/**
 * Update an existing Facility entry
 * - Validates if the facility exists
 * - Ensures active facility count does not exceed 4 when updating status
 * @param id - Facility ID to update
 * @param data - Partial facility data for update
 * @returns Updated Facility record
 */
const updateFacility = async (id: string, data: Partial<Facility>) => {
  // Check whether the facility exists
  const facility = await prisma.facility.findUnique({ where: { id } });
  if (!facility) {
    throw new ApiError(httpStatus.NOT_FOUND, "Facility not found");
  }

  // Perform update operation in a transaction
  return prisma.$transaction(async (tx) => {
    // If the update sets this facility as active, check limit of active facilities
    if (data.active) {
      const facilities = await tx.facility.findMany({
        where: { active: true },
      });

      if (facilities.length >= 4) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Only 4 facility can be active at a time",
        );
      }
    }

    // Update the facility record
    return tx.facility.update({
      where: { id: facility.id },
      data,
    });
  });
};

/**
 * Delete a Facility entry by its ID
 * @param id - Unique ID of the Facility to be deleted
 * @returns Deleted Facility record
 */
const deleteFacility = async (id: string) => {
  // Delete the facility record from the database
  return prisma.facility.delete({ where: { id } });
};

const cmsService = {
  getContent,
  updateContent,

  // ====== Carousel Banner ======
  getPaginatedCarouselBanner,
  createCarouselBanner,
  updateCarouselBanner,
  deleteCarouselBanner,

  // ====== Featured Banner ======
  getPaginatedFeaturedBanner,
  createFeaturedBanner,
  updateFeaturedBanner,
  deleteFeaturedBanner,

  // ====== Who We Serve Banner ======
  getPaginatedWhoWeServeBanner,
  createWhoWeServeBanner,
  updateWhoWeServeBanner,
  deleteWhoWeServeBanner,

  // Customer CTA
  getPaginatedCustomerCta,
  createCustomerCta,
  updateCustomerCta,
  deleteCustomerCta,

  // Limited Stock
  getPaginatedLimitedStock,
  createLimitedStock,
  updateLimitedStock,
  deleteLimitedStock,

  // Why Choose Us
  getPaginatedWhyChooseUs,
  createWhyChooseUs,
  updateWhyChooseUs,
  deleteWhyChooseUs,

  // Certifications
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
  getPaginatedVenderCta,
  createVendorCta,
  updateVendorCta,
  deleteVendorCta,

  // Sell Origin
  getPaginatedSellOrigin,
  createSellOrigin,
  updateSellOrigin,
  deleteSellOrigin,

  // Facilities
  getPaginatedFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
};

export default cmsService;
