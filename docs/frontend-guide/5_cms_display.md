# Storefront CMS Rendering & Custom Component Mapping

This document details how the dynamic marketing elements and promotional components fetched from the CMS endpoint are dynamically mapped and rendered into storefront pages.

---

## 1. CMS API Structure Overview

The entire homepage structure is configurable by administrators. The storefront downloads this dynamic payload to render customized marketing rows.

*   **Endpoint**: `GET /cms`
*   **Response Structure (Key Blocks)**:
    ```typescript
    interface CustomImage {
      url: string;
      href?: string;     // Click path link (e.g. "/products?categoryId=...")
      altText: string;
    }

    interface Feature {
      graphicUrl: string;
      text: string;
      subText: string;
    }

    interface CMSPayload {
      bannerCarousel: Array<{
        title: string;
        active: boolean;
        media: CustomImage[];
      }>;
      featuredBanners: Array<{
        title: string;
        active: boolean;
        squareCarousel: CustomImage[];
        horizontalCarousel: CustomImage[];
        staticImage1: CustomImage;
        staticImage2: CustomImage;
      }>;
      whoWeServe: Array<{
        title: string;
        active: boolean;
        features: Feature[];
      }>;
      whyChooseUs: Array<{
        title: string;
        active: boolean;
        heading?: { text: string; subText: string };
        staticImage: CustomImage;
        cards: Feature[];
      }>;
      certifications: Array<{
        title: string;
        active: boolean;
        media: CustomImage;
      }>;
    }
    ```

---

## 2. Dynamic Homepage Renderer

Create a wrapper layout component that parses the payload and maps each active block to its corresponding visual styling template.

### `src/components/cms/CMSPageBuilder.tsx`
```typescript
import React from 'react';
import { HeroCarousel } from './HeroCarousel';
import { PromotionalGrid } from './PromotionalGrid';
import { BenefitsSection } from './BenefitsSection';
import { CertificationsRow } from './CertificationsRow';

interface CMSPageBuilderProps {
  cmsData: any; // CMSPayload response
}

export const CMSPageBuilder: React.FC<CMSPageBuilderProps> = ({ cmsData }) => {
  if (!cmsData) return null;

  // Active banner groups
  const activeCarousel = cmsData.bannerCarousel?.find((c: any) => c.active);
  const activeFeatured = cmsData.featuredBanners?.find((f: any) => f.active);
  const activeServe = cmsData.whoWeServe?.find((w: any) => w.active);
  const activeWhy = cmsData.whyChooseUs?.find((u: any) => u.active);
  const activeCerts = cmsData.certifications?.filter((c: any) => c.active) || [];

  return (
    <div className="space-y-16">
      {/* 1. Main Swiper Banner Carousel */}
      {activeCarousel && (
        <HeroCarousel mediaItems={activeCarousel.media} />
      )}

      {/* 2. Customer Audience Focus Section */}
      {activeServe && (
        <section className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-slate-800 text-center mb-8">
            {activeServe.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {activeServe.features.map((feature: any, idx: number) => (
              <div key={idx} className="flex flex-col items-center text-center p-6 border rounded-2xl bg-slate-50">
                <img src={feature.graphicUrl} alt="" className="w-16 h-16 object-contain mb-4" />
                <h3 className="font-semibold text-slate-800 text-lg">{feature.text}</h3>
                <p className="text-slate-500 text-sm mt-2">{feature.subText}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Promotional Grid Sections */}
      {activeFeatured && (
        <PromotionalGrid data={activeFeatured} />
      )}

      {/* 4. Brand Value Cards */}
      {activeWhy && (
        <BenefitsSection data={activeWhy} />
      )}

      {/* 5. Accreditations & Certifications Carousel */}
      {activeCerts.length > 0 && (
        <CertificationsRow items={activeCerts} />
      )}
    </div>
  );
};
```

---

## 3. Rendering Banners & Promos

### HeroCarousel Layout
Implement using a swiper framework (like `swiper/react` or a modern scroll-snap configuration for performance). Use lazy loading for slide images.

```typescript
// HeroCarousel.tsx
import Link from 'next/link';

export const HeroCarousel = ({ mediaItems }: { mediaItems: any[] }) => {
  return (
    <div className="relative w-full aspect-[21/9] md:aspect-[24/8] overflow-hidden bg-slate-100">
      {/* For simplicity, we display the first slide. Integrators should map this inside a Carousel. */}
      {mediaItems.map((slide, idx) => (
        <div key={idx} className="absolute inset-0 w-full h-full">
          <img
            src={slide.url}
            alt={slide.altText}
            className="w-full h-full object-cover"
            loading={idx === 0 ? "eager" : "lazy"}
          />
          {slide.href && (
            <Link href={slide.href}>
              <span className="absolute inset-0 cursor-pointer" aria-label={slide.altText} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
};
```

### Why Choose Us Benefits Section
This combines an image and feature cards into a premium asymmetrical layout (grid of image side-by-side with cards list).

```typescript
// BenefitsSection.tsx
export const BenefitsSection = ({ data }: { data: any }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Banner image representation */}
        <div className="overflow-hidden rounded-3xl shadow-sm">
          <img
            src={data.staticImage.url}
            alt={data.staticImage.altText}
            className="w-full object-cover aspect-[4/3] hover:scale-105 transition-transform duration-700"
          />
        </div>
        
        {/* Features Content list */}
        <div>
          {data.heading && (
            <div className="mb-8">
              <span className="text-xs uppercase tracking-wider text-green-600 font-bold">Value Proposition</span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{data.heading.text}</h2>
              <p className="text-slate-500 mt-2">{data.heading.subText}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.cards.map((card: any, idx: number) => (
              <div key={idx} className="p-5 border border-slate-100 rounded-2xl bg-white hover:shadow-md transition-shadow">
                <img src={card.graphicUrl} alt="" className="w-10 h-10 mb-3" />
                <h4 className="font-semibold text-slate-800">{card.text}</h4>
                <p className="text-sm text-slate-500 mt-1">{card.subText}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```
