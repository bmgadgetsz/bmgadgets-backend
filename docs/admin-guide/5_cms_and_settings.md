# Content Management (CMS) & Media Uploads

This section describes how the admin manages the dynamic storefront components, schedules slides, pins recommended product cards, and uploads media assets.

---

## 1. Media Uploads (S3 Integration)

Before creating banners or catalog cards, admins must upload graphic files (PNG, JPG, MP4) to the S3 bucket.

*   **Endpoint**: `POST /common/file-upload`
*   **Permissions Required**: Authenticated Admin session
*   **Request Type**: `multipart/form-data`
*   **Form Parameters**:
    *   `file`: Binary file array (name key must be exactly `file`)
    *   `directory`: Sub-folder path (e.g., `"banners"`, `"products"`, `"avatars"`)
*   **API Response**:
    ```json
    {
      "success": true,
      "message": "File uploaded successfully",
      "data": [
        "https://bmq-s3-bucket.s3.ap-south-1.amazonaws.com/bmq/banners/promo-slide-df8398b1-3e4b.png"
      ]
    }
    ```

---

## 2. Dynamic Homepage Curation (CMS Blocks)

The storefront renders its landing sections based on blocks defined in the CMS collection. Admins retrieve the entire page configuration to reorder blocks or edit text directly.

### A. Fetch Current Landing Setup
*   **Endpoint**: `GET /cms`
*   **Response**: Returns the fully aggregated CMS document, including carousel arrays, benefit panels, and certification slots.

### B. Global Block Toggle & Ordering
*   **Endpoint**: `PATCH /cms`
*   **Request Payload**: Updates root identifiers.
    ```json
    {
      "certifications": ["65cd1b24e6a8d80f86cf0001", "65cd1b24e6a8d80f86cf0002"]
    }
    ```

---

## 3. Creating & Editing Component Blocks

Admins manage specific block elements via the following dedicated sub-routers.

### A. Homepage Hero Carousel (`/cms/carousel`)
The main sliders at the top of the storefront. Only one slider collection group should be marked as `active: true` at a time.
*   **Create Slides Group**: `POST /cms/carousel`
*   **Request Payload**:
    ```json
    {
      "title": "August Monsoon Electronics Sale",
      "active": true,
      "contentId": "65cd1b24e6a8d80f86cf8888", // Main Content ID from GET /cms
      "media": [
        {
          "url": "https://assets.bmgadgets.com/banners/slide1.jpg",
          "altText": "Noise Cancelling Audio Gear",
          "href": "/products?categoryId=audio_cat_id"
        }
      ]
    }
    ```
*   **Update / Toggle Active**: `PATCH /cms/carousel/:id`
*   **Delete Carousel**: `DELETE /cms/carousel/:id`

### B. Promotional Grid (`/cms/featured`)
Sets up a grid structure containing a mix of smaller square scrolls, wide banners, and static product call-outs.
*   **Create Featured Grid**: `POST /cms/featured`
*   **Request Payload**:
    ```json
    {
      "title": "Top Tech Picks",
      "active": true,
      "contentId": "65cd1b24e6a8d80f86cf8888",
      "squareCarousel": [
        { "url": "https://assets.bmgadgets.com/grid/sq1.jpg", "altText": "Smart Fit Band", "href": "/products/1" }
      ],
      "horizontalCarousel": [
        { "url": "https://assets.bmgadgets.com/grid/hz1.jpg", "altText": "Home Audio System", "href": "/products/2" }
      ],
      "staticImage1": { "url": "https://assets.bmgadgets.com/grid/stat1.jpg", "altText": "Gaming Gear", "href": "/products/3" },
      "staticImage2": { "url": "https://assets.bmgadgets.com/grid/stat2.jpg", "altText": "Office Monitors", "href": "/products/4" }
    }
    ```

### C. Target Audiences block (`/cms/serve`)
Crates card blocks showing target segments (e.g. "Gamers", "Office Goers", "Students").
*   **Endpoint**: `POST /cms/serve`
*   **Request Payload**:
    ```json
    {
      "title": "Who We Serve",
      "active": true,
      "contentId": "65cd1b24e6a8d80f86cf8888",
      "features": [
        {
          "graphicUrl": "https://assets.bmgadgets.com/icons/gaming.png",
          "text": "For Gamers",
          "subText": "Ultra-low latency controllers and audio gear."
        }
      ]
    }
    ```

### D. Why Choose Us Section (`/cms/whyChooseUs`)
Explains the brand's quality certifications or guarantee policies.
*   **Endpoint**: `POST /cms/whyChooseUs`
*   **Request Payload**:
    ```json
    {
      "title": "Why BMGadgets",
      "active": true,
      "contentId": "65cd1b24e6a8d80f86cf8888",
      "heading": {
        "text": "The Premium Gadget Destination",
        "subText": "Every item undergoes rigorous quality diagnostics."
      },
      "staticImage": { "url": "https://assets.bmgadgets.com/about.jpg", "altText": "Lab testing" },
      "cards": [
        { "graphicUrl": "https://assets.bmgadgets.com/guarantee.png", "text": "1-Year Warranty", "subText": "Instant replacement." }
      ]
    }
    ```

---

## 4. Product Pinning & Recommendations

To feature specific products or collections on the storefront homepage, admins use two strategies:

### A. Toggling the "Featured" Flag
When editing any product (`PATCH /products/:id`), setting the `"featured": true` property inserts the item into the homepage's "Featured Products" grid row.

### B. Limited Stock / Flash Deals Grid (`/cms/limitedStock`)
Admins create flash-sales cards that link directly to specific discount checkout pages.
*   **Create Limited Stock Block**: `POST /cms/limitedStock`
*   **Payload**:
    ```json
    {
      "title": "Deals of the Week",
      "active": true,
      "contentId": "65cd1b24e6a8d80f86cf8888",
      "media": [
        {
          "url": "https://assets.bmgadgets.com/deals/watch.jpg",
          "href": "/products/smartwatch-v2",
          "altText": "Only 5 units remaining!"
        }
      ]
    }
    ```
