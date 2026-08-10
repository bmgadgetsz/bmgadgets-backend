/* eslint-disable no-console */
import env from "./config/env";
import prisma from "./config/prisma";

(async () => {
  console.log("[Database Seed] Starting database seeding process...");

  console.log("[Database Seed] Checking if 'Customer' role exists...");
  // Customer Role
  const customerRole = await prisma.role.findFirst({
    where: { isCustomer: true },
  });
  if (!customerRole) {
    console.log(
      "[Database Seed] 'Customer' role not found. Creating 'Customer' role...",
    );
    await prisma.role.create({
      data: {
        name: "Customer",
        description: "Role for customers",
        isCustomer: true,
      },
    });
    console.log("[Database Seed] 'Customer' role created successfully.");
  } else {
    console.log("[Database Seed] 'Customer' role already exists.");
  }

  // Vendor
  console.log("[Database Seed] Checking if 'Vendor' role exists...");
  const vendorRole = await prisma.role.findFirst({
    where: { isVendor: true },
  });
  if (!vendorRole) {
    console.log(
      "[Database Seed] 'Vendor' role not found. Creating 'Vendor' role...",
    );
    await prisma.role.create({
      data: {
        name: "Vendor",
        description: "Role for vendors",
        isVendor: true,
      },
    });
    console.log("[Database Seed] 'Vendor' role created successfully.");
  } else {
    console.log("[Database Seed] 'Vendor' role already exists.");
  }

  console.log("[Database Seed] Checking if 'Admin' role exists...");
  // Admin role
  let adminRole = await prisma.role.findFirst({
    where: { isAdmin: true },
  });
  if (!adminRole) {
    console.log(
      "[Database Seed] 'Admin' role not found. Creating 'Admin' role...",
    );
    adminRole = await prisma.role.create({
      data: {
        name: "Admin",
        description: "Role for administrators",
        isAdmin: true,
      },
    });
    console.log("[Database Seed] 'Admin' role created successfully.");
  } else {
    console.log("[Database Seed] 'Admin' role already exists.");
  }

  console.log("[Database Seed] Checking if Super Admin user exists...");
  const superAdmin = await prisma.user.findUnique({
    where: { email: env.app.superadminEmail },
  });
  if (!superAdmin) {
    console.log(
      "[Database Seed] Super Admin user not found. Creating Super Admin user...",
    );
    await prisma.user.create({
      data: {
        email: env.app.superadminEmail,
        phone: `PLACEHOLDER#${env.app.superadminEmail}`,
        roleId: adminRole!.id,
      },
    });
    console.log("[Database Seed] Super Admin user created successfully.");
  } else {
    console.log("[Database Seed] Super Admin user already exists.");
  }

  // --- Dummy seed vendor creation
  // Customize these placeholder values as needed. The script checks for existing vendor by email or phone.
  const dummyVendorEmail = env.app.seedVendorEmail;
  const dummyVendorPhone = env.app.seedVendorPhone;

  // find whether there's already a user with this email or phone
  const existingVendorUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: dummyVendorEmail }, { phone: dummyVendorPhone }],
    },
  });

  const vendorRoleFromDb = await prisma.role.findFirst({
    where: { isVendor: true },
  });

  if (!vendorRoleFromDb) {
    console.error(
      "[Database Seed] Vendor role missing unexpectedly. Skipping vendor seed.",
    );
  } else if (existingVendorUser) {
    // If a user exists but does not have vendorProfile, ensure vendorProfile exists or skip
    const existingVendorProfile = await prisma.vendorProfile.findFirst({
      where: { userId: existingVendorUser.id },
    });

    if (existingVendorProfile) {
      console.log(
        "[Database Seed] Dummy vendor already exists. Skipping vendor creation.",
      );
    } else {
      console.log(
        "[Database Seed] User exists but vendor profile missing. Creating vendorProfile for existing user...",
      );
      await prisma.vendorProfile.create({
        data: {
          userId: existingVendorUser.id,
          businessName: "Seed Vendor Business",
          natureOfBusiness: "Dummy / Seed",
          contactPersonName: existingVendorUser.name ?? "Seed Vendor",
          email: dummyVendorEmail,
          mobileNumber: dummyVendorPhone,
          onboardingStatus: "KYC_APPROVED", // optionally set to an appropriate status
          isActive: true, // set true to enable vendor for testing; change as required
          isOriginO: true, // mark as origin/seed vendor
          // you can fill other optional KYC fields if desired
        },
      });
      console.log("[Database Seed] VendorProfile created for existing user.");
    }
  } else {
    // create both the user and vendorProfile in a transaction
    console.log(
      "[Database Seed] Creating dummy vendor user + vendorProfile...",
    );
    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dummyVendorEmail,
          phone: dummyVendorPhone,
          roleId: vendorRoleFromDb.id,
          active: true,
          // optionally fill name or other fields
          name: "Seed Vendor",
        },
      });

      await tx.vendorProfile.create({
        data: {
          userId: createdUser.id,
          businessName: "Seed Vendor Business",
          natureOfBusiness: "Dummy / Seed",
          contactPersonName: "Seed Vendor",
          email: dummyVendorEmail,
          mobileNumber: dummyVendorPhone,
          onboardingStatus: "REGISTRATION_APPROVED", // modify if you prefer KYC_PENDING
          isActive: true,
          isOriginO: true, // important flag to identify seed vendor
          // optional: fill other KYC/document fields as needed for testing
        },
      });
    });
    console.log("[Database Seed] Dummy vendor created successfully.");
  }

  console.log("[Database Seed] Checking if content exists.");
  let content = await prisma.content.findFirst();

  if (!content) {
    console.log(
      "[Database Seed] Content does not exist, creating new content...",
    );
    content = await prisma.content.create({ data: {} });
  }

  // Seed BannerCarousel under the content
  const carouselExists = await prisma.bannerCarousel.findFirst({
    where: { contentId: content.id },
  });

  if (!carouselExists) {
    console.log("[Database Seed] Seeding Banner Carousel sliders...");
    await prisma.bannerCarousel.create({
      data: {
        title: "Main Homepage Slideshow",
        active: true,
        contentId: content.id,
        media: [
          {
            url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
            altText: "Premium Noise Cancelling Headphones - 45% OFF",
            href: "/products",
          },
          {
            url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
            altText: "Minimalist Smartwatch Series - Stay Connected",
            href: "/products",
          },
          {
            url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
            altText: "Next-Gen Gaming Gear & Audio Setup",
            href: "/products",
          },
        ],
      },
    });
    console.log("[Database Seed] Banner Carousel sliders seeded successfully.");
  } else {
    console.log("[Database Seed] Banner Carousel sliders already exist.");
  }

  console.log("[Database Seed] Checking if company info exists.");
  const companyInfoExists = await prisma.companyInfo.findFirst();
  if (!companyInfoExists) {
    console.log(
      "[Database Seed] Company info does not exist, creating default company info...",
    );
    await prisma.companyInfo.create({
      data: {},
    });
  } else {
    console.log("[Database Seed] Company info already exists.");
  }

  console.log("[Database Seed] Database seeding process completed.");
})();
