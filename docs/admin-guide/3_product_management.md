# Product, Variant & Combo Management

This section details how the admin manages the product catalog, variant properties, dynamic prices, combo packages, and listing status approvals.

---

## 1. Product Catalog CRUD

Products are stored with descriptions, certifications, origin data, and links to global tags, brands, categories, and HSN codes.

### A. Creating a Product
To create a new product, send a `POST` request. If variants are passed in the `varients` array, they are created automatically along with the product.
*   **Endpoint**: `POST /products`
*   **Permissions Required**: `PRODUCT_MANAGEMENT` (WRITE)
*   **Request Payload**:
    ```json
    {
      "name": "SuperFit Smartwatch V2",
      "brandId": "65cd1b24e6a8d80f86cf2345",
      "hsnId": "65cd1b24e6a8d80f86cf4567",
      "tags": ["wearables", "fitness", "new-arrival"],
      "originCountry": "India",
      "description": "A premium health and fitness tracker with AMOLED display.",
      "ingredients": "Aluminum body, silicone strap, lithium-ion battery.",
      "healthBenefits": "Tracks heart rate, sleep quality, and workouts.",
      "usageInstructions": "Charge fully before first use, sync with mobile app.",
      "storageInstructions": "Store in a cool, dry place when not wearing.",
      "certifications": ["CRUELTY_FREE"],
      "thumbnailImageUrl": "https://assets.bmgadgets.com/products/smartwatch_thumb.jpg",
      "imageUrls": [
        "https://assets.bmgadgets.com/products/smartwatch_detail1.jpg",
        "https://assets.bmgadgets.com/products/smartwatch_detail2.jpg"
      ],
      "videoUrl": "https://assets.bmgadgets.com/products/smartwatch_promo.mp4",
      "attributes": ["AMOLED", "5ATM Water Resistant", "14-Day Battery"],
      "active": true,
      "featured": false,
      "varients": [
        {
          "variantId": "65cd1b24e6a8d80f86cf1111", // e.g., "Midnight Black" size/color variant option ID
          "discountPercentage": 10,
          "mfgDate": "2026-06-01T00:00:00.000Z",
          "expiryDate": "2029-06-01T00:00:00.000Z",
          "weightInGrams": 45,
          "prices": [
            {
              "price": 3500,
              "discountedPrice": 3150,
              "active": true
            }
          ]
        }
      ]
    }
    ```
*   **Response**: `201 Created` with the complete product object.

### B. Catalog Listing & Search Filters
Retrieve products with standard pagination, sorting, status filters, and stock markers.
*   **Endpoint**: `GET /products`
*   **Query Parameters**:
    *   `page` / `limit`: Pagination parameters.
    *   `search`: Text search matches product name or description.
    *   `categoryId`: Filter by specific category.
    *   `productStatus`: Filter by listing status (`"PENDING"` | `"ACCEPTED"` | `"REJECTED"`).
    *   `active`: Filter by active status (`"true"` | `"false"`).
    *   `inStock`: Filter out of stock products (`"true"` | `"false"`).

---

## 2. Managing Product Variants & Price Lists

Products can have multiple variants (e.g. size, color, pack weight). Each product variant has its own stock levels, manufacturing/expiry dates, and price lists.

### A. Add a Variant to an Existing Product
*   **Endpoint**: `POST /products/:productId/variants`
*   **Request Payload**:
    ```json
    {
      "variantId": "65cd1b24e6a8d80f86cf1122", // Global Variant Option ID (e.g. "Silver Grey")
      "discountPercentage": 5,
      "mfgDate": "2026-06-10T00:00:00.000Z",
      "expiryDate": "2029-06-10T00:00:00.000Z",
      "weightInGrams": 45,
      "prices": [
        {
          "price": 3800,
          "discountedPrice": 3610,
          "active": true
        }
      ]
    }
    ```

### B. Update Variant pricing or details
*   **Endpoint**: `PATCH /products/:productId/variants/:variantId`
*   **Request Payload**:
    ```json
    {
      "discountPercentage": 15,
      "prices": [
        {
          "price": 3800,
          "discountedPrice": 3230,
          "active": true
        }
      ]
    }
    ```

### C. Remove a Variant
*   **Endpoint**: `DELETE /products/:productId/variants/:variantId`

---

## 3. Product Combo Bundles

Combos allow admins to bundle multiple product variants together at a special promotional price.

### A. Create a Product Combo
*   **Endpoint**: `POST /product-combos`
*   **Permissions Required**: `COMBO_MANAGEMENT` (WRITE)
*   **Request Payload**:
    ```json
    {
      "productId": "65cd1b24e6a8d80f86cf8888", // Parent main product ID
      "name": "Ultimate Tech Fitness Bundle",
      "description": "Smartwatch V2 + Premium Silicone Strap Combo",
      "imageUrl": "https://assets.bmgadgets.com/combos/fitness_bundle.jpg",
      "weightInGrams": 120,
      "active": true,
      "items": [
        {
          "productVariantId": "65cd1b24e6a8d80f86cf1111", // Smartwatch V2 variant
          "quantity": 1
        },
        {
          "productVariantId": "65cd1b24e6a8d80f86cf9999", // Extra Strap variant
          "quantity": 1
        }
      ],
      "prices": [
        {
          "price": 4500,
          "discountedPrice": 3999,
          "active": true
        }
      ]
    }
    ```

### B. Read and Update Combos
*   **Get Combos**: `GET /product-combos`
*   **Update Combo**: `PATCH /product-combos/:id` (Support changing items array or prices)
*   **Delete Combo**: `DELETE /product-combos/:id`

---

## 4. Admin Workflow: Product Status & Onboarding Approvals

The backend operates a verification process for catalog items. Newly uploaded products or edits by third-party/onboarded vendors default to `productStatus: "PENDING"` and `active: false`. Admins must review the submission and accept or reject it.

### Approve / Reject Listing Action
*   **Endpoint**: `PATCH /products/:productId/status`
*   **Permissions Required**: `PRODUCT_APPROVAL` or `PRODUCT_MANAGEMENT` (WRITE)
*   **Request Body**:
    ```json
    {
      "productStatus": "ACCEPTED", // Or "REJECTED"
      "rejectionReason": ""        // Mandatory if productStatus is "REJECTED"
    }
    ```
*   **Action Flow**:
    1. Once an admin sets `productStatus` to `ACCEPTED`, the product status updates. By default, it remains `active: false`.
    2. Admin can toggle the product to `active: true` explicitly once warehouse stock allocations are validated.

---

## 5. Fetching Auxiliary Catalog Meta-Data

When loading product creation forms, populate the dropdown selections using these auxiliary GET requests:

*   **Global Brands**: `GET /brands?limit=100` (returns all active product labels)
*   **Global Categories**: `GET /categories` (returns departments/categories tree)
*   **Global Sub-Categories**: `GET /sub-categories` (subsections associated with categories)
*   **HSN & Tax Configuration**: `GET /hsn-config` (HSN numbers, IGST/CGST/SGST ratios)
*   **Global Variant Attributes**: `GET /variants` (lists options like colors/weights used to tag variant models)
