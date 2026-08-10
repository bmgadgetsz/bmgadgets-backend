# Administrative Operations & Role-Based Access Control (RBAC)

This section outlines team/employee management, Role-Based Access Control configuration, review moderation, customer support ticketing, and warehouse inventory allocation.

---

## 1. Employee Management & Team Profiles

The primary store owner (Super Admin) can onboard staff members (Employees) to handle day-to-day business operations (e.g. support agents, product catalog managers).

### A. Add a Staff Member / Employee
Onboard an employee by providing their email/phone and linking them to a permissioned Role ID.
*   **Endpoint**: `POST /employees`
*   **Permissions Required**: `USER_MANAGEMENT` (WRITE)
*   **Request Payload**:
    ```json
    {
      "email": "agent.smith@bmgadgets.com",
      "phone": "9876543222",
      "roleId": "65cd1b24e6a8d80f86cf7777", // Target Role ID
      "name": "Agent Smith"
    }
    ```
*   **Response**: `201 Created` with the employee user model.

### B. List Team Members
*   **Endpoint**: `GET /employees`
*   **Query Parameters**: standard pagination (`page`, `limit`) and filters.

---

## 2. RBAC Roles & Custom Permissions Configuration

Permissions are grouped into Roles. The system checks permissions based on resource modules (e.g., `ORDER_MANAGEMENT`, `PRODUCT_MANAGEMENT`, `BANNERS`) and accessibility verbs (`READ`, `WRITE`, `DELETE`).

### A. Create a Customized Role
*   **Endpoint**: `POST /rbac`
*   **Permissions Required**: `RBAC_MODULE` (WRITE)
*   **Request Payload**:
    ```json
    {
      "name": "Customer Support Lead",
      "description": "Can read order details and resolve support tickets.",
      "permissions": [
        {
          "resource": "TICKET_MODULE",
          "access": ["READ", "WRITE"]
        },
        {
          "resource": "ORDER_MANAGEMENT",
          "access": ["READ"]
        }
      ]
    }
    ```

### B. Modify Role Permissions
*   **Endpoint**: `PATCH /rbac/:id`
*   **Delete Role**: `DELETE /rbac/:id`

---

## 3. Customer Product Review Moderation

To maintain review authenticity, reviews submitted by customers default to `approved: false`. Staff must review their content before pushing them live on storefront product pages.

### A. List Reviews for Moderation
*   **Endpoint**: `GET /reviews`
*   **Permissions Required**: `REVIEW_MANAGEMENT` (READ)
*   **API Response**:
    ```json
    {
      "success": true,
      "data": {
        "results": [
          {
            "id": "rev_987",
            "rating": 5,
            "message": "Perfect smartwatch! Battery easily lasts 2 weeks.",
            "approved": false,
            "productId": "prod_123",
            "createdBy": { "user": { "name": "Jane Doe" } }
          }
        ]
      }
    }
    ```

### B. Approve a Review (Publish Live)
*   **Endpoint**: `PATCH /reviews/:id`
*   **Permissions Required**: `REVIEW_MANAGEMENT` (WRITE)
*   **Request Body**:
    ```json
    {
      "approved": true
    }
    ```

---

## 4. Helpdesk Support Ticket Response System

Admins resolve user questions, product return inquiries, or invoice discrepancies via the Ticket system.

### A. Fetch Customer Support Tickets
*   **Endpoint**: `GET /tickets`
*   **Permissions Required**: `TICKET_MODULE` (READ)
*   **Query Filters**: `status` (`"OPEN"` | `"IN_PROGRESS"` | `"RESOLVED"`), `priority` (`"LOW"` | `"MEDIUM"` | `"HIGH"`).

### B. Post a Response / Comment
*   **Endpoint**: `POST /tickets/:ticketId/comments`
*   **Request Payload**:
    ```json
    {
      "message": "We have checked your order. The courier agent will pick up the return item tomorrow."
    }
    ```

### C. Update Ticket Status (Resolve)
*   **Endpoint**: `PATCH /tickets/:id`
*   **Request Payload**:
    ```json
    {
      "status": "RESOLVED"
    }
    ```

---

## 5. Warehouse Inventory & Stock Levels

To support reliable single-warehouse delivery routing, admins manage quantities of variants across multiple regional hubs.

### A. View Stocks
*   **Endpoint**: `GET /warehouse-stocks`
*   **Response**: lists quantities of specific variants mapped to warehouses.

### B. Allocate Stock / Adjust Inventory
Add or update quantity counts for a variant inside a specific warehouse location.
*   **Create Stock Entry**: `POST /warehouse-stocks`
    ```json
    {
      "warehouseId": "65cd1b24e6a8d80f86cf6666",
      "productVariantId": "65cd1b24e6a8d80f86cf1111",
      "quantity": 150
    }
    ```
*   **Adjust Stock Count**: `PATCH /warehouse-stocks/:id` (where `:id` is the stock allocation record ID)
    ```json
    {
      "quantity": 200
    }
    ```
