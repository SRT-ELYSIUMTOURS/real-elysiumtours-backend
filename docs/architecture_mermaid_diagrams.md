# Elysium Tours — Backend Architecture Mermaid Diagrams
> Pass each code block individually to DeepSeek for diagram generation

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["🌐 Customer Website<br/>(React 19 + Vite)"]
        ADMIN["🔧 Admin Dashboard<br/>(React Admin Panel)"]
        MOBILE["📱 Mobile App<br/>(Future Phase)"]
    end

    subgraph "API Gateway Layer"
        GW["Moleculer API Gateway<br/>Rate Limiting | CORS | Auth Middleware"]
    end

    subgraph "Microservices Layer"
        subgraph "Core Services"
            AUTH["Auth Service<br/>JWT + OAuth"]
            USER["User Service<br/>Profiles & Entities"]
            RBAC["RBAC Service<br/>Roles & Permissions"]
        end

        subgraph "Tour Domain Services"
            TOUR_PKG["Tour Package Service<br/>Pre-packaged Tours"]
            TOUR_DYN["Dynamic Tour Service<br/>Build-Your-Own"]
            PRICING["Pricing Desk Service<br/>Manual Quote Management"]
            BOOKING["Booking Service<br/>Reservations & Status"]
            PAYMENT["Payment Service<br/>Transactions & Invoicing"]
        end

        subgraph "Partner Services"
            HOTEL["Hotel Partner Service<br/>Partner Hotels & Tiers"]
            TRANSPORT["Transport Service<br/>Vehicles & Routes"]
            ATTRACTION["Attraction Service<br/>Destinations & Activities"]
            DINING["Dining Service<br/>Restaurant Partners"]
        end

        subgraph "Communication Services"
            EMAIL["Email Service<br/>Transactional + Marketing"]
            NOTIF["Notification Service<br/>Push, Email, SMS"]
            TEMPLATE["Template Service<br/>Email & Message Templates"]
        end

        subgraph "Platform Services"
            MEDIA["Media Service<br/>Cloudinary Uploads"]
            SEARCH["Search Service<br/>Tours & Destinations"]
            ANALYTICS["Analytics Service<br/>Bookings & Revenue"]
            CMS["CMS Sync Service<br/>Sanity.io Content"]
        end
    end

    subgraph "Data Layer"
        MONGO[(MongoDB<br/>Primary Database)]
        REDIS[(Redis<br/>Cache & Queues)]
        SANITY[(Sanity CMS<br/>Content Management)]
        CLOUD[(Cloudinary<br/>Media Storage)]
    end

    WEB --> GW
    ADMIN --> GW
    MOBILE --> GW
    GW --> AUTH
    GW --> USER
    GW --> RBAC
    GW --> TOUR_PKG
    GW --> TOUR_DYN
    GW --> PRICING
    GW --> BOOKING
    GW --> PAYMENT
    GW --> HOTEL
    GW --> TRANSPORT
    GW --> ATTRACTION
    GW --> DINING
    GW --> MEDIA
    GW --> SEARCH
    GW --> ANALYTICS
    GW --> CMS

    AUTH --> MONGO
    USER --> MONGO
    RBAC --> MONGO
    TOUR_PKG --> MONGO
    TOUR_DYN --> MONGO
    PRICING --> MONGO
    BOOKING --> MONGO
    PAYMENT --> MONGO
    HOTEL --> MONGO
    TRANSPORT --> MONGO
    ATTRACTION --> MONGO
    DINING --> MONGO
    ANALYTICS --> MONGO

    NOTIF --> REDIS
    EMAIL --> REDIS
    SEARCH --> REDIS
    CMS --> SANITY
    MEDIA --> CLOUD

    PRICING --> EMAIL
    PRICING --> NOTIF
    BOOKING --> EMAIL
    BOOKING --> NOTIF
    PAYMENT --> EMAIL
```

---

## 2. Microservice Architecture (Detailed Service Map)

```mermaid
graph LR
    subgraph "API Gateway"
        API["api.service.js<br/>───────────<br/>/api/auth/*<br/>/api/users/*<br/>/api/tours/*<br/>/api/bookings/*<br/>/api/partners/*<br/>/api/admin/*<br/>/api/media/*<br/>/api/search/*<br/>/api/notifications/*"]
    end

    subgraph "Auth & Identity"
        A1["auth.service<br/>───────────<br/>register<br/>login<br/>verifyOTP<br/>refreshToken<br/>googleOAuth<br/>forgotPassword"]
        A2["user.service<br/>───────────<br/>getProfile<br/>updateProfile<br/>uploadAvatar<br/>switchEntity<br/>listUsers (admin)"]
        A3["rbac.service<br/>───────────<br/>createRole<br/>assignPermission<br/>checkAccess<br/>entityManagement"]
    end

    subgraph "Tour Management"
        T1["tourPackage.service<br/>───────────<br/>listPackages<br/>getPackage<br/>createPackage (admin)<br/>updatePackage (admin)<br/>toggleActive (admin)<br/>getPricing"]
        T2["dynamicTour.service<br/>───────────<br/>getDestinations<br/>getOptions<br/>buildTourRequest<br/>submitForPricing<br/>getMyRequests<br/>cancelRequest"]
        T3["pricingDesk.service<br/>───────────<br/>getQueue (admin)<br/>assignQuote (admin)<br/>submitQuote (admin)<br/>sendToCustomer<br/>customerAccept<br/>customerReject<br/>getSLAMetrics"]
    end

    subgraph "Booking & Payment"
        B1["booking.service<br/>───────────<br/>createBooking<br/>getBooking<br/>listBookings<br/>updateStatus (admin)<br/>cancelBooking<br/>generateInvoice"]
        B2["payment.service<br/>───────────<br/>initiatePayment<br/>verifyPayment<br/>refundPayment<br/>getTransactions<br/>reconcile (admin)"]
    end

    subgraph "Partner Management"
        P1["hotelPartner.service<br/>───────────<br/>listHotels<br/>getHotel<br/>registerPartner (admin)<br/>updatePartner (admin)<br/>setCommission (admin)<br/>getByDestination"]
        P2["transport.service<br/>───────────<br/>listVehicles<br/>getCapacityOptions<br/>registerProvider (admin)<br/>updateRoutes (admin)<br/>estimateBase"]
        P3["attraction.service<br/>───────────<br/>listAttractions<br/>getByDestination<br/>createAttraction (admin)<br/>updateAttraction (admin)<br/>setAvailability"]
        P4["dining.service<br/>───────────<br/>listRestaurants<br/>getByDestination<br/>registerPartner (admin)<br/>updatePartner (admin)<br/>setMenuOptions"]
    end

    subgraph "Communication"
        C1["email.service"]
        C2["notification.service"]
        C3["template.service"]
        C4["sms.service"]
    end

    subgraph "Platform"
        PL1["media.service"]
        PL2["search.service"]
        PL3["analytics.service"]
        PL4["cms.service"]
    end

    API --> A1
    API --> A2
    API --> A3
    API --> T1
    API --> T2
    API --> T3
    API --> B1
    API --> B2
    API --> P1
    API --> P2
    API --> P3
    API --> P4
    API --> C1
    API --> C2
    API --> PL1
    API --> PL2
    API --> PL3
    API --> PL4
```

---

## 3. Pre-Packaged Tour Flow (Customer Journey)

```mermaid
sequenceDiagram
    actor Customer
    participant Web as Customer Website
    participant API as API Gateway
    participant TourPkg as Tour Package Service
    participant Booking as Booking Service
    participant Payment as Payment Service
    participant Email as Email Service
    participant Notif as Notification Service

    Customer->>Web: Browse tour packages
    Web->>API: GET /api/tours/packages
    API->>TourPkg: listPackages(filters)
    TourPkg-->>API: Tour packages with pricing tiers
    API-->>Web: Package cards (destination, price by group size)
    Web-->>Customer: Display tour cards

    Customer->>Web: Select package (Cape Coast, 10 people)
    Web->>API: GET /api/tours/packages/:id
    API->>TourPkg: getPackage(id)
    TourPkg-->>API: Full package details
    API-->>Web: Hotel, attractions, transport, itinerary, price
    Web-->>Customer: Package detail page

    Customer->>Web: Click "Book This Tour"
    Web->>API: POST /api/bookings
    API->>Booking: createBooking(packageId, groupSize, date, customer)
    Booking->>TourPkg: validatePackage(packageId)
    TourPkg-->>Booking: Package valid + price confirmed
    Booking-->>API: Booking created (status: pending_payment)
    API-->>Web: Booking confirmation + payment link

    Customer->>Web: Proceed to payment
    Web->>API: POST /api/payments/initiate
    API->>Payment: initiatePayment(bookingId, amount)
    Payment-->>API: Payment gateway redirect URL
    API-->>Web: Redirect to payment
    Web-->>Customer: Payment gateway

    Customer->>Web: Payment completed
    Web->>API: POST /api/payments/verify
    API->>Payment: verifyPayment(transactionRef)
    Payment->>Booking: updateStatus(bookingId, confirmed)
    Payment-->>API: Payment verified

    Booking->>Email: sendBookingConfirmation(customer, booking)
    Booking->>Notif: createNotification(customer, booking_confirmed)
    Email-->>Customer: Booking confirmation email
    Notif-->>Customer: In-app notification
```

---

## 4. Dynamic Tour (Build-Your-Own) Flow

```mermaid
sequenceDiagram
    actor Customer
    participant Web as Customer Website
    participant API as API Gateway
    participant DynTour as Dynamic Tour Service
    participant Hotel as Hotel Partner Service
    participant Transport as Transport Service
    participant Attraction as Attraction Service
    participant Dining as Dining Service
    participant Desk as Pricing Desk Service
    participant Email as Email Service
    actor Staff as Pricing Staff (Admin)

    Customer->>Web: Click "Build Your Own Tour"
    Web->>API: GET /api/tours/destinations
    API->>DynTour: getDestinations()
    DynTour-->>Web: Available destinations

    Customer->>Web: Select destination (Cape Coast)
    Web->>API: GET /api/tours/options?destination=cape-coast
    API->>Hotel: getByDestination(cape-coast)
    API->>Attraction: getByDestination(cape-coast)
    API->>Dining: getByDestination(cape-coast)
    Hotel-->>API: Hotels (3-star, 4-star, 5-star options)
    Attraction-->>API: Attractions list
    Dining-->>API: Restaurant options
    API-->>Web: All options for destination
    Web-->>Customer: Dropdown selections

    Customer->>Web: Fill selections
    Note over Customer,Web: Group size: 8<br/>Hotel: 4-star partner hotel<br/>Attractions: Castle, Canopy Walk<br/>Dining: Seafood restaurant<br/>Duration: 3 days

    Customer->>Web: Click "Submit for Pricing"
    Web->>API: POST /api/tours/dynamic/submit
    API->>DynTour: buildTourRequest(selections)
    DynTour->>Desk: createQuoteRequest(tourRequest)
    Desk-->>DynTour: Quote request ID + SLA (2-3 days)
    DynTour-->>API: Request submitted
    API-->>Web: Confirmation + reference number
    Web-->>Customer: "Pricing will be sent within 2-3 days"

    DynTour->>Email: sendSubmissionConfirmation(customer)
    Desk->>Notif: notifyStaff(newQuoteRequest)

    Staff->>Desk: Open pricing queue
    Desk-->>Staff: Tour request details

    Staff->>Desk: Calculate pricing manually
    Note over Staff,Desk: Factor in:<br/>- Transport (8 people = 15-seater bus)<br/>- Fuel costs (current rates)<br/>- Hotel rates (partner negotiated)<br/>- Attraction entry fees<br/>- Dining package<br/>- Margin

    Staff->>Desk: Submit quote
    Desk->>Email: sendPricingQuote(customer, quote)
    Desk->>Notif: notifyCustomer(pricing_ready)
    Email-->>Customer: Email with pricing + options

    alt Customer Accepts
        Customer->>Web: Accept quote
        Web->>API: POST /api/tours/dynamic/accept/:quoteId
        API->>Desk: customerAccept(quoteId)
        Desk->>API: Create booking from accepted quote
        Note over API: Follows same payment flow as pre-packaged
    else Customer Rejects
        Customer->>Web: Reject or request changes
        Web->>API: POST /api/tours/dynamic/reject/:quoteId
        API->>Desk: customerReject(quoteId, reason)
        Desk->>Notif: notifyStaff(quote_rejected)
    end
```

---

## 5. Admin Dashboard Architecture

```mermaid
graph TB
    subgraph "Admin Dashboard (React)"
        subgraph "Dashboard Home"
            DASH_HOME["Overview Dashboard<br/>───────────<br/>Active Bookings Count<br/>Pending Quotes Count<br/>Revenue Summary<br/>SLA Compliance<br/>Recent Activity Feed"]
        end

        subgraph "Tour Management"
            PKG_MGMT["Package Management<br/>───────────<br/>Create/Edit Packages<br/>Set Pricing Tiers<br/>Upload Photos<br/>Toggle Active/Inactive<br/>View Package Analytics"]
            DEST_MGMT["Destination Management<br/>───────────<br/>Add/Edit Destinations<br/>Map Regions<br/>Assign Attractions<br/>Set Availability"]
        end

        subgraph "Pricing Desk"
            QUOTE_QUEUE["Quote Queue<br/>───────────<br/>Incoming Requests<br/>Assigned to Me<br/>SLA Timer Display<br/>Priority Sorting"]
            QUOTE_DETAIL["Quote Builder<br/>───────────<br/>Tour Request Details<br/>Cost Calculator (manual)<br/>Margin Settings<br/>Send Quote to Customer<br/>Quote History"]
        end

        subgraph "Booking Management"
            BOOK_LIST["Booking List<br/>───────────<br/>All Bookings<br/>Filter by Status<br/>Search by Customer<br/>Date Range Filter"]
            BOOK_DETAIL["Booking Detail<br/>───────────<br/>Customer Info<br/>Tour Details<br/>Payment Status<br/>Update Status<br/>Cancel/Refund"]
        end

        subgraph "Partner Management"
            HOTEL_MGMT["Hotel Partners<br/>───────────<br/>Register New Partner<br/>Set Commission Rates<br/>Update Availability<br/>View Performance"]
            TRANS_MGMT["Transport Partners<br/>───────────<br/>Register Providers<br/>Vehicle Fleet<br/>Route Management<br/>Pricing Base Rates"]
            ATTR_MGMT["Attractions<br/>───────────<br/>Add/Edit Attractions<br/>Set Entry Fees<br/>Partner Agreements<br/>Photos & Description"]
            DINE_MGMT["Dining Partners<br/>───────────<br/>Register Restaurants<br/>Menu Options<br/>Commission Rates<br/>Availability"]
        end

        subgraph "Customer Management"
            CUST_LIST["Customer List<br/>───────────<br/>All Customers<br/>Search & Filter<br/>Booking History<br/>Communication Log"]
            CUST_COMMS["Customer Comms<br/>───────────<br/>Send Email/DM<br/>Quote Responses<br/>Support Tickets"]
        end

        subgraph "Analytics & Reports"
            REV_REPORT["Revenue Reports<br/>───────────<br/>Daily/Weekly/Monthly<br/>By Package<br/>By Destination<br/>Commission Tracking"]
            BOOK_REPORT["Booking Analytics<br/>───────────<br/>Conversion Rates<br/>Popular Destinations<br/>Group Size Trends<br/>Seasonal Patterns"]
            SLA_REPORT["SLA Performance<br/>───────────<br/>Quote Response Times<br/>Breached SLAs<br/>Staff Performance"]
            PARTNER_REPORT["Partner Reports<br/>───────────<br/>Commission Payouts<br/>Booking Volume<br/>Rating & Reviews"]
        end

        subgraph "Settings"
            PLATFORM_SET["Platform Settings<br/>───────────<br/>SLA Configuration<br/>Email Templates<br/>Notification Rules<br/>Payment Gateway Config"]
            USER_MGMT["User & Role Mgmt<br/>───────────<br/>Staff Accounts<br/>Role Assignment<br/>Permission Matrix<br/>Activity Logs"]
        end
    end
```

---

## 6. Data Model (Entity Relationship)

```mermaid
erDiagram
    USER ||--o{ BOOKING : makes
    USER ||--o{ TOUR_REQUEST : submits
    USER {
        ObjectId _id
        string email
        string password
        string firstName
        string lastName
        string phone
        string avatar
        string role
        boolean isVerified
        string status
        Date lastLogin
    }

    TOUR_PACKAGE ||--o{ BOOKING : booked_as
    TOUR_PACKAGE ||--o{ PACKAGE_PRICING : has_legacy_tiers
    TOUR_PACKAGE ||--o{ ACCOMMODATION_OPTION : offers
    TOUR_PACKAGE }|--|| DESTINATION : at
    TOUR_PACKAGE }o--o{ ATTRACTION : includes
    TOUR_PACKAGE }o--|| HOTEL_PARTNER : stays_at
    TOUR_PACKAGE {
        ObjectId _id
        string title
        string description
        string slug
        ObjectId destinationId
        ObjectId hotelPartnerId
        array attractionIds
        array diningIds
        string transportType
        array images
        string displayCurrency
        boolean isActive
        string status
    }

    PACKAGE_PRICING {
        ObjectId _id
        ObjectId packageId
        int minGroupSize
        int maxGroupSize
        number pricePerPerson
        number totalPrice
        string currency
    }

    ACCOMMODATION_OPTION }o--|| HOTEL_PARTNER : primary
    ACCOMMODATION_OPTION ||--o{ ACCOMMODATION_PRICING_ROW : prices
    ACCOMMODATION_OPTION ||--o{ DESTINATION_HOTEL_MAP : per_city
    ACCOMMODATION_OPTION {
        ObjectId _id
        string label
        string tier
        ObjectId hotelPartnerId
        string description
        boolean isActive
    }

    ACCOMMODATION_PRICING_ROW {
        string roomType
        int minGroupSize
        int maxGroupSize
        number pricePerPerson
    }

    DESTINATION_HOTEL_MAP }o--|| DESTINATION : for
    DESTINATION_HOTEL_MAP }o--|| HOTEL_PARTNER : maps_to
    DESTINATION_HOTEL_MAP {
        ObjectId destinationId
        ObjectId hotelPartnerId
        int nights
    }

    DESTINATION ||--o{ TOUR_PACKAGE : offers
    DESTINATION ||--o{ ATTRACTION : has
    DESTINATION ||--o{ HOTEL_PARTNER : located_in
    DESTINATION ||--o{ DINING_PARTNER : located_in
    DESTINATION {
        ObjectId _id
        string name
        string region
        string description
        object gpsCoords
        array images
        boolean isActive
    }

    TOUR_REQUEST ||--|| QUOTE : receives
    TOUR_REQUEST }|--|| DESTINATION : going_to
    TOUR_REQUEST {
        ObjectId _id
        ObjectId customerId
        ObjectId destinationId
        int groupSize
        string hotelPreference
        array selectedAttractions
        array diningPreferences
        string transportPreference
        Date preferredDate
        int durationDays
        string specialRequests
        string status
        Date submittedAt
    }

    QUOTE ||--o| BOOKING : converts_to
    QUOTE {
        ObjectId _id
        ObjectId tourRequestId
        ObjectId assignedStaffId
        number totalPrice
        number pricePerPerson
        object costBreakdown
        string currency
        string status
        Date sentAt
        Date respondedAt
        Date slaDeadline
        string customerResponse
    }

    BOOKING ||--|| PAYMENT : paid_via
    BOOKING {
        ObjectId _id
        ObjectId customerId
        ObjectId packageId
        ObjectId quoteId
        string bookingType
        string bookingRef
        int groupSize
        Date tourDate
        Date endDate
        number totalAmount
        string currency
        string displayCurrency
        ObjectId accommodationOptionId
        string accommodationLabel
        string accommodationTier
        string roomType
        number pricePerPerson
        string status
        Date createdAt
    }

    PAYMENT }o--o| FOREX_RATE : locked_at
    PAYMENT {
        ObjectId _id
        ObjectId bookingId
        ObjectId customerId
        number amount
        string currency
        string displayCurrency
        number amountInDisplayCurrency
        string settlementCurrency
        number amountGHS
        number fxRate
        Date fxLockedAt
        ObjectId fxRateRef
        string provider
        string transactionRef
        string status
        Date paidAt
        object metadata
    }

    FOREX_RATE {
        ObjectId _id
        string fromCurrency
        string toCurrency
        number rate
        number markupPercent
        Date effectiveDate
        Date expiresAt
        string source
        boolean isActive
    }

    HOTEL_PARTNER }|--|| DESTINATION : in
    HOTEL_PARTNER {
        ObjectId _id
        string name
        ObjectId destinationId
        string tier
        number commissionRate
        object contactInfo
        boolean isActive
        array amenities
        array images
    }

    TRANSPORT_PROVIDER ||--o{ VEHICLE : owns
    TRANSPORT_PROVIDER {
        ObjectId _id
        string companyName
        string contactPerson
        string phone
        boolean isActive
        number commissionRate
    }

    VEHICLE {
        ObjectId _id
        ObjectId providerId
        string type
        int capacity
        number basePricePerDay
        boolean isAvailable
    }

    ATTRACTION }|--|| DESTINATION : located_in
    ATTRACTION {
        ObjectId _id
        string name
        ObjectId destinationId
        string category
        number entryFee
        string description
        array images
        boolean isActive
    }

    DINING_PARTNER }|--|| DESTINATION : in
    DINING_PARTNER {
        ObjectId _id
        string name
        ObjectId destinationId
        string cuisineType
        string tier
        number commissionRate
        boolean isActive
    }
```

---

## 7. Middleware & Auth Flow

```mermaid
sequenceDiagram
    participant Client as Client (Web/Admin)
    participant GW as API Gateway
    participant MW1 as dbIdNormalizer
    participant MW2 as rbacPermissions
    participant MW3 as organizationScoping
    participant SVC as Target Service
    participant DB as MongoDB

    Client->>GW: HTTP Request + JWT Token

    GW->>GW: authenticate()<br/>Extract JWT from Authorization header
    GW->>GW: Decode token → {userId, email, role}
    GW->>GW: Set ctx.meta.user

    GW->>MW1: Pass to middleware chain
    MW1->>MW1: Normalize _id fields<br/>(ObjectId ↔ string)

    MW1->>MW2: Next middleware
    MW2->>MW2: Check action.auth level
    alt auth = undefined
        MW2->>MW2: Public route — pass through
    else auth = "required"
        MW2->>MW2: Verify ctx.meta.user exists
    else auth = "admin"
        MW2->>MW2: Verify role === "admin"
    end

    MW2->>MW3: Next middleware
    MW3->>MW3: Detect organization context<br/>(header/subdomain/query)

    MW3->>SVC: Call service action
    SVC->>DB: Database operation
    DB-->>SVC: Result
    SVC-->>GW: Response
    GW-->>Client: HTTP Response
```

---

## 8. Deployment Architecture

```mermaid
graph TB
    subgraph "Internet"
        CUSTOMER["Customer Browser"]
        ADMIN_USER["Admin Browser"]
    end

    subgraph "CDN / Edge"
        CF["Cloudflare / Vercel Edge<br/>Static Assets + CDN"]
    end

    subgraph "Frontend Hosting (Vercel)"
        FE_CUST["Customer Website<br/>(React SPA)"]
        FE_ADMIN["Admin Dashboard<br/>(React SPA)"]
    end

    subgraph "Backend Hosting (Render / Railway)"
        subgraph "API Container"
            API_SVC["API Gateway Service<br/>Port 3001<br/>SERVICES=api"]
        end

        subgraph "Core Worker Container"
            CORE["Core Services<br/>SERVICES=auth,user,rbac,<br/>tourPackage,dynamicTour,<br/>booking,payment"]
        end

        subgraph "Partner Worker Container"
            PARTNER["Partner Services<br/>SERVICES=hotelPartner,<br/>transport,attraction,<br/>dining,pricingDesk"]
        end

        subgraph "Comms Worker Container"
            COMMS["Communication Services<br/>SERVICES=email,sms,<br/>notification,template"]
        end
    end

    subgraph "Data Services"
        MONGO_ATLAS["MongoDB Atlas<br/>Primary Database"]
        REDIS_CLOUD["Redis Cloud<br/>Cache + Bull Queues"]
        SANITY_IO["Sanity.io<br/>CMS Content"]
        CLOUDINARY["Cloudinary<br/>Media Storage"]
    end

    subgraph "External Services"
        PAYSTACK["Payment Gateway<br/>(Paystack / Stripe)"]
        SENDGRID["SendGrid<br/>Email Delivery"]
        TWILIO["Twilio / AT<br/>SMS Delivery"]
    end

    CUSTOMER --> CF
    ADMIN_USER --> CF
    CF --> FE_CUST
    CF --> FE_ADMIN
    FE_CUST --> API_SVC
    FE_ADMIN --> API_SVC

    API_SVC <-->|NATS/Redis Transporter| CORE
    API_SVC <-->|NATS/Redis Transporter| PARTNER
    API_SVC <-->|NATS/Redis Transporter| COMMS

    CORE --> MONGO_ATLAS
    PARTNER --> MONGO_ATLAS
    COMMS --> REDIS_CLOUD
    CORE --> REDIS_CLOUD

    COMMS --> SENDGRID
    COMMS --> TWILIO
    CORE --> PAYSTACK
    CORE --> CLOUDINARY
    PARTNER --> SANITY_IO
```

---

## 9. Tour Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Browsing: Customer visits site

    state "Pre-Packaged Flow" as PrePkg {
        Browsing --> PackageSelected: Select a package
        PackageSelected --> BookingCreated: Click "Book Tour"
        BookingCreated --> PendingPayment: Booking confirmed
        PendingPayment --> PaymentProcessing: Initiate payment
        PaymentProcessing --> Confirmed: Payment verified
        PaymentProcessing --> PaymentFailed: Payment failed
        PaymentFailed --> PendingPayment: Retry payment
    }

    state "Dynamic Tour Flow" as Dynamic {
        Browsing --> BuildingTour: Click "Build Your Own"
        BuildingTour --> SelectingOptions: Choose destination
        SelectingOptions --> SubmittedForPricing: Submit selections
        SubmittedForPricing --> InPricingQueue: Enter desk queue
        InPricingQueue --> AssignedToStaff: Staff picks up
        AssignedToStaff --> QuoteSent: Quote calculated & sent
        QuoteSent --> QuoteAccepted: Customer accepts
        QuoteSent --> QuoteRejected: Customer rejects
        QuoteSent --> QuoteExpired: SLA expires with no response
        QuoteAccepted --> BookingFromQuote: Create booking
        BookingFromQuote --> PendingPayment2: Awaiting payment
        PendingPayment2 --> PaymentProcessing2: Initiate payment
        PaymentProcessing2 --> Confirmed2: Payment verified
    }

    Confirmed --> TourScheduled: Tour date approaching
    Confirmed2 --> TourScheduled

    TourScheduled --> TourInProgress: Tour date arrives
    TourInProgress --> TourCompleted: Tour ends
    TourCompleted --> ReviewRequested: Request feedback
    ReviewRequested --> [*]

    state "Cancellation" as Cancel {
        PendingPayment --> Cancelled: Customer cancels
        Confirmed --> CancelledWithRefund: Cancel within policy
        BookingFromQuote --> Cancelled: Customer cancels
    }
```

---

## 10. Admin Pricing Desk Workflow

```mermaid
flowchart TB
    START([New Tour Request Submitted]) --> QUEUE[Enter Pricing Queue]
    QUEUE --> SLA{SLA Timer Started<br/>2-3 Days}

    SLA --> ASSIGN[Staff Assigned / Self-Assigned]
    ASSIGN --> REVIEW[Review Tour Request Details]

    REVIEW --> CALC[Calculate Costs]

    subgraph "Cost Calculation"
        CALC --> TRANS_COST[Transport Cost<br/>Vehicle type by group size<br/>+ Fuel estimate<br/>+ Driver fee]
        CALC --> HOTEL_COST[Hotel Cost<br/>Partner rate × nights<br/>× rooms needed]
        CALC --> ATTR_COST[Attraction Fees<br/>Entry fees × group size]
        CALC --> DINING_COST[Dining Cost<br/>Meal packages × group size<br/>× days]
        CALC --> MARGIN[Add Margin<br/>Platform commission<br/>+ Partner commissions]

        TRANS_COST --> TOTAL[Total Quote]
        HOTEL_COST --> TOTAL
        ATTR_COST --> TOTAL
        DINING_COST --> TOTAL
        MARGIN --> TOTAL
    end

    TOTAL --> PRICE_CHECK{Price Reasonable?}
    PRICE_CHECK -->|Yes| SEND_QUOTE[Send Quote to Customer<br/>Email + In-App Notification]
    PRICE_CHECK -->|No, adjust| CALC

    SEND_QUOTE --> WAIT{Customer Response}
    WAIT -->|Accepted| CONVERT[Convert to Booking<br/>→ Payment Flow]
    WAIT -->|Rejected| FEEDBACK[Capture Rejection Reason]
    WAIT -->|No Response| FOLLOWUP[Send Follow-Up Reminder]
    FOLLOWUP --> WAIT2{Response?}
    WAIT2 -->|Yes| WAIT
    WAIT2 -->|Expired| CLOSE[Close Request]

    FEEDBACK --> REVISE{Revise Quote?}
    REVISE -->|Yes| CALC
    REVISE -->|No| CLOSE

    SLA -->|Breached| ESCALATE[Escalate to Admin<br/>SLA Breach Alert]
    ESCALATE --> ASSIGN
```

---

## 11. Complete Page Map (Customer + Admin)

```mermaid
graph TB
    subgraph "Customer Website Pages"
        C_HOME["Home Page<br/>Hero + Featured Tours<br/>+ Search + Testimonials"]
        C_TOURS["Tours Listing<br/>Filter by destination,<br/>price, group size"]
        C_PKG_DETAIL["Package Detail<br/>Itinerary, pricing tiers,<br/>gallery, reviews, CTA"]
        C_BUILD["Build Your Own Tour<br/>Destination dropdown<br/>Hotel/Attraction/Dining<br/>Group size + dates<br/>Submit for pricing"]
        C_DEST["Destinations<br/>All destinations<br/>with featured tours"]
        C_DEST_DETAIL["Destination Detail<br/>About, attractions,<br/>hotels, weather, tips"]
        C_ABOUT["About Us<br/>Company story, team,<br/>mission"]
        C_CONTACT["Contact<br/>Form + map + info"]
        C_AUTH["Auth Pages<br/>Login, Register,<br/>Forgot Password, OTP"]
        C_PROFILE["My Profile<br/>Account settings,<br/>preferences"]
        C_BOOKINGS["My Bookings<br/>Active, past, cancelled<br/>Booking detail view"]
        C_QUOTES["My Quotes<br/>Pending quotes,<br/>accept/reject,<br/>quote detail"]
        C_PAYMENT["Payment<br/>Payment gateway<br/>Confirmation"]
        C_FAQ["FAQ / Help"]
        C_BLOG["Blog / Travel Tips<br/>(Sanity CMS)"]
    end

    subgraph "Admin Dashboard Pages"
        A_DASH["Dashboard Home<br/>KPIs, charts, alerts"]
        A_TOURS["Tour Packages CRUD<br/>List, create, edit,<br/>pricing tiers, photos"]
        A_DEST["Destinations CRUD<br/>Manage destinations<br/>and regions"]
        A_DESK["Pricing Desk<br/>Queue, assign, build<br/>quote, send, track SLA"]
        A_BOOKINGS["Bookings Management<br/>All bookings, status<br/>updates, cancellations"]
        A_PAYMENTS["Payment Management<br/>Transactions, refunds<br/>reconciliation"]
        A_HOTELS["Hotel Partners CRUD<br/>Register, commission,<br/>availability"]
        A_TRANSPORT["Transport CRUD<br/>Providers, vehicles,<br/>routes, pricing"]
        A_ATTRACTIONS["Attractions CRUD<br/>Add/edit, fees,<br/>by destination"]
        A_DINING["Dining Partners CRUD<br/>Restaurants, menus,<br/>commissions"]
        A_CUSTOMERS["Customer Management<br/>List, search, history,<br/>communication"]
        A_STAFF["Staff Management<br/>Accounts, roles,<br/>permissions"]
        A_ANALYTICS["Analytics<br/>Revenue, bookings,<br/>popular tours, trends"]
        A_SLA["SLA Dashboard<br/>Response times,<br/>breaches, performance"]
        A_CMS["CMS Management<br/>Blog posts, FAQs,<br/>testimonials"]
        A_SETTINGS["Platform Settings<br/>SLA config, email<br/>templates, payment<br/>gateway, notifications"]
        A_COMMS["Communication Hub<br/>Email campaigns,<br/>notification logs"]
    end

    C_HOME --> C_TOURS
    C_HOME --> C_DEST
    C_HOME --> C_BUILD
    C_TOURS --> C_PKG_DETAIL
    C_PKG_DETAIL --> C_PAYMENT
    C_DEST --> C_DEST_DETAIL
    C_BUILD --> C_QUOTES
    C_AUTH --> C_PROFILE
    C_PROFILE --> C_BOOKINGS
    C_PROFILE --> C_QUOTES
```
