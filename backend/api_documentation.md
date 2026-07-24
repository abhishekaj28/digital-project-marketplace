# ProjectHub Backend REST API Documentation

This document describes the REST API endpoints provided by the ProjectHub Flask backend. All endpoints are prefixed with `/api`.

---

## Authentication

Authentication is handled via JSON Web Tokens (JWT). The login endpoint returns both an `access_token` (valid for 15 minutes) and a `refresh_token` (valid for 7 days).

Protected endpoints require the token to be passed in the `Authorization` header:
```http
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### 1. Register User
* **URL**: `/api/auth/register`
* **Method**: `POST`
* **Payload**:
  ```json
  {
    "email": "student@university.edu",
    "password": "SecurePassword123",
    "name": "Alex Student"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "message": "Registration successful! Please verify your email. A demo link has been logged in the backend console."
  }
  ```

### 2. Login User
* **URL**: `/api/auth/login`
* **Method**: `POST`
* **Payload**:
  ```json
  {
    "email": "student@university.edu",
    "password": "SecurePassword123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbG...",
    "refresh_token": "eyJhbG...",
    "user": {
      "id": "603f9b2d6a782b3d3c8c919a",
      "email": "student@university.edu",
      "name": "Alex Student",
      "role": "user"
    }
  }
  ```

### 3. Refresh Access Token
* **URL**: `/api/auth/refresh`
* **Method**: `POST`
* **Payload**:
  ```json
  {
    "refresh_token": "eyJhbG..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbG..."
  }
  ```

### 4. Logout User
* **URL**: `/api/auth/logout`
* **Method**: `POST`
* **Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

### 5. Verify Email
* **URL**: `/api/auth/verify-email/<token>`
* **Method**: `GET`
* **Response**: Redirects to the frontend login page (`http://localhost:5173/login?verified=true`).

---

## Projects Endpoints

### 1. List Projects
* **URL**: `/api/projects`
* **Method**: `GET`
* **Query Parameters**:
  * `category` (slug, optional)
  * `price` (`under500`, `500to1000`, `over1000`, optional)
  * `sort` (`popularity`, `rating`, `priceAsc`, `priceDesc`, `newest`, optional)
  * `q` (search term, optional)
* **Response (200 OK)**: Array of Project objects.

### 2. Get Project Details
* **URL**: `/api/projects/<id_or_slug>`
* **Method**: `GET`
* **Response (200 OK)**: Single Project object.

### 3. Search Projects
* **URL**: `/api/projects/search`
* **Method**: `GET`
* **Query Parameters**:
  * `q` (search query, required)
* **Response (200 OK)**: Array of matching Project objects.

---

## Categories Endpoints

### 1. List Categories
* **URL**: `/api/categories`
* **Method**: `GET`
* **Response (200 OK)**: Array of Category objects.

---

## Reviews Endpoints

### 1. Create Review
* **URL**: `/api/reviews`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <access_token>` (Required, must own the project)
* **Payload**:
  ```json
  {
    "projectId": "603f9b2d6a782b3d3c8c919a",
    "rating": 5,
    "comment": "Outstanding code quality. Saved me weeks of work!"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "message": "Review submitted successfully."
  }
  ```

### 2. List Reviews for Project
* **URL**: `/api/reviews/<projectId>`
* **Method**: `GET`
* **Response (200 OK)**: Array of Review objects.

---

## Wishlist Endpoints

### 1. Get Wishlist
* **URL**: `/api/wishlist`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response (200 OK)**: Array of Wishlisted Project objects.

### 2. Add to Wishlist
* **URL**: `/api/wishlist/add`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <access_token>`
* **Payload**:
  ```json
  {
    "projectId": "603f9b2d6a782b3d3c8c919a"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "message": "Added to wishlist."
  }
  ```

### 3. Remove from Wishlist
* **URL**: `/api/wishlist/remove/<projectId>`
* **Method**: `DELETE`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response (200 OK)**:
  ```json
  {
    "message": "Removed from wishlist."
  }
  ```

---

## Payments & Downloads

### 1. Initiate Razorpay Order
* **URL**: `/api/payments/create-order`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <access_token>`
* **Payload**:
  ```json
  {
    "projectId": "603f9b2d6a782b3d3c8c919a"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "order_id": "order_mock_a8d7c...",
    "amount": 899,
    "currency": "INR",
    "key_id": "",
    "name": "ProjectHub",
    "description": "AI Resume Screening & Parser System",
    "prefill": {"email": "buyer@example.com"},
    "is_mock": true
  }
  ```

### 2. Verify Razorpay Transaction
* **URL**: `/api/payments/verify`
* **Method**: `POST`
* **Headers**: `Authorization: Bearer <access_token>`
* **Payload**:
  ```json
  {
    "razorpay_order_id": "order_mock_a8d7c...",
    "razorpay_payment_id": "pay_mock_98fc23da"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 3. Retrieve Purchased Projects
* **URL**: `/api/purchases`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response (200 OK)**: Array of purchase records containing nested project structures.

### 4. Retrieve Downloadable Files
* **URL**: `/api/downloads`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response (200 OK)**: Array of accessible artifacts grouped by project.

### 5. Securely Download File
* **URL**: `/api/payments/download/<project_id>/<filename>`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response**: Redirects to the asset URL or streams the file, increments `downloadCount`, and logs to the `downloads` table.

---

## Admin Endpoints

### 1. Admin Analytics
* **URL**: `/api/admin/analytics`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <access_token>`
* **Response (200 OK)**:
  ```json
  {
    "totalUsers": 45,
    "totalRevenue": 24000,
    "totalOrders": 28,
    "totalDownloads": 72,
    "topCategories": [{"name": "Artificial Intelligence", "downloads": 15}],
    "topProjects": [{"title": "AI Resume Screener", "downloads": 10}],
    "monthlyRevenue": [{"month": "Jun", "revenue": 14000, "orders": 16}],
    "recentOrders": [...]
  }
  ```

### 2. Category Management
* **Create Category**: `POST /api/admin/categories` (Form-data with `name`, `description`, `thumbnail` file)
* **Update Category**: `PUT /api/admin/categories/<id>` (Form-data with `name`, `description`, `thumbnail` file)
* **Delete Category**: `DELETE /api/admin/categories/<id>`

### 3. Project Management
* **Create Project**: `POST /api/admin/projects` (Form-data with file fields: `thumbnail`, `zipFile`, `pdfReport`, `pptFile`, `abstract`, `vivaQuestions`, `documentation`)
* **Update Project**: `PUT /api/admin/projects/<id>`
* **Delete Project**: `DELETE /api/admin/projects/<id>`
