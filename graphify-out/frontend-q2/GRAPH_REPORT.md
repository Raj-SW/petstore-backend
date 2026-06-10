# Graph Report - frontend/src/Pages  (2026-06-10)

## Corpus Check
- Corpus is ~29,188 words - fits in a single context window. You may not need a graph.

## Summary
- 258 nodes · 225 edges · 59 communities (33 shown, 26 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `ToastContext` - 12 edges
2. `UserProfile Page` - 11 edges
3. `CartCheckoutPage` - 8 edges
4. `AdminDashboard Page` - 7 edges
5. `AppointmentCalendar Component` - 6 edges
6. `AdminProducts Page` - 5 edges
7. `AdminOrders()` - 4 edges
8. `AdminAppointments Page` - 4 edges
9. `AdminOrders Page` - 4 edges
10. `AdminProductForm Page` - 4 edges

## Surprising Connections (you probably didn't know these)
- `UserProfile Page` --uses--> `usersApi Service`  [EXTRACTED]
  frontend/src/Pages/UserProfile.jsx → frontend/src/Services/api/usersApi.js
- `AppointmentCalendar Component` --uses--> `appointmentsApi Service`  [EXTRACTED]
  frontend/src/Pages/AppointmentPage/AppointmentCalendar/appointmentCalendar.jsx → frontend/src/Services/api/appointmentsApi.js
- `CartCheckoutPage` --uses--> `ordersApi Service`  [EXTRACTED]
  frontend/src/Pages/CartCheckoutPage/CartCheckOutPage.jsx → frontend/src/Services/api/ordersApi.js
- `UserProfile Page` --uses--> `Breadcrumb Component`  [EXTRACTED]
  frontend/src/Pages/UserProfile.jsx → frontend/src/Components/HelperComponents/Breadcrumb/Breadcrumb.jsx
- `UserProfile Page` --uses--> `ConfirmModal Component`  [EXTRACTED]
  frontend/src/Pages/UserProfile.jsx → frontend/src/Components/UserProfile/ConfirmModal.jsx

## Hyperedges (group relationships)
- **Admin CRUD Pages with DataTable Pattern** — adminappointments_AdminAppointments, adminorders_AdminOrders, adminproducts_AdminProducts, adminusers_AdminUsers, components_DataTable, context_ToastContext [INFERRED 0.90]
- **Cart-to-Payment Checkout Flow** — cartcheckout_CartCheckoutPage, services_ordersApi, services_cartApi, context_CartContext, components_CheckoutStepper [EXTRACTED 0.95]
- **User Appointment Booking Flow** — appointmentpage_AppointmentPage, appointmentcalendar_AppointmentCalendar, components_ProfessionalList, services_appointmentsApi, context_AuthContext [EXTRACTED 0.95]
- **Checkout-to-Confirmation Payment Flow** — paymentpage_PaymentPage, paymentpage_CheckoutForm, orderconfirmedpage_OrderConfirmedPage, myorderspage_MyOrdersPage [INFERRED 0.90]
- **HomePage Banner Carousel Cluster** — carouselcomponent_CarouselComponent, bannercarousel_BannerCarousel, promobannercarousel_PromoBannerCarousel, imagepaths_imagePathsDeskTop [INFERRED 0.85]
- **PetShop Filter and Product Browse Flow** — petshoppage_PetShopPage, filtercomponent_FilterComponent, individualproductitempage_IndividualProductItemPage [INFERRED 0.85]
- **Auth Modal Flow (SignUpDropdown orchestrates Login and SignUp modals)** — signupdropdown_SignUpDropdown, signupmodal_SignUpModal, authcontext_AuthContext, toastcontext_ToastContext [EXTRACTED 0.95]
- **RichText Editor System (Editor, Toolbar, Extensions, Renderer)** — richtexteditor_RichTextEditor, toolbar_Toolbar, extensions_buildExtensions, extensions_TOOLBAR_GROUPS, richtextrenderer_RichTextRenderer, richtext_index [EXTRACTED 1.00]
- **UserProfile Modal Components** — confirmmodal_ConfirmModal, passwordchangeform_PasswordChangeForm, petform_PetForm, petlist_PetList, profileform_ProfileForm [INFERRED 0.85]
- **Shadcn/Radix UI Primitives** — accordion_Accordion, button_Button, card_Card, carousel_Carousel, input_Input, label_Label, separator_Separator, tabs_Tabs [INFERRED 0.90]

## Communities (59 total, 26 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (27): AdminAnalytics Page, AdminAppointments Page, AdminDashboard Page, AdminInventory Page, AdminInvoices Page, AdminOrders Page, AdminProductForm Page, AdminProducts Page (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (11): PROMO_SLIDES, slideVariants, TABS, FEATURES, SERVICES, SLIDE_IMAGES, slideVariants, STATS (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (16): AppointmentCalendar Component, AppointmentPage, AppointmentCard Component, AppointmentForm Component, Breadcrumb Component, ConfirmModal Component, PasswordChangeForm Component, PetForm Component (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (10): FilterComponent, IndividualProductItemPage, ProductSectionTabs, MyOrdersPage, OrderTimeline, RefundModal, OrderConfirmedPage, CheckoutForm (Stripe) (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (5): FILTER_TABS, PAYMENT_META, REFUND_REASONS, STATUS_META, TIMELINE_STEPS

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (6): BADGE, EMPTY_ADJUST, EMPTY_HISTORY, EMPTY_RESTOCK, MOVEMENT_TYPE_COLORS, STATUS_OPTS

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (3): CATEGORIES, RATINGS, QUICK_CATS

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (7): CartCheckoutPage, CartItem Component, CheckoutStepper Component, Price Component, CartContext, CurrencyContext, cartApi Service

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (3): CATEGORIES, EMPTY_FORM, GENDERS

### Community 10 - "Community 10"
Cohesion: 0.53
Nodes (5): AdminOrders(), fmt(), getPaymentClass(), getStatusClass(), STATUS_OPTIONS

### Community 11 - "Community 11"
Cohesion: 0.60
Nodes (6): TOOLBAR_GROUPS, buildExtensions, RichText Index (barrel), RichTextEditor, RichTextRenderer, Toolbar

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): AdminAppointments(), formatDateTime(), STATUS_OPTIONS

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (3): btnSpring, EMPTY_ADDRESS, stepVariants

### Community 17 - "Community 17"
Cohesion: 0.40
Nodes (3): EMPTY_DRAWER, STATUS_BADGE, STATUS_OPTS

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (5): ImportExportServicePage, ExportImportForm (ImportPage), ServiceCard (ServicePage), ServicePage, StatCard (ServicePage)

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (3): METHOD_OPTS, TYPE_BADGE, TYPE_OPTS

### Community 22 - "Community 22"
Cohesion: 0.50
Nodes (3): imagePathsDeskTop, imagePathsMobile, imagePathsTablet

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (4): BannerCarousel, CarouselComponent, imagePathsDeskTop (imagePaths), PromoBannerCarousel

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (4): AuthContext, SignUpDropdown, SignUpModal, ToastContext

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): Button, Carousel, CarouselContext

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (3): ConfirmModal, PetForm, PetList

## Knowledge Gaps
- **116 isolated node(s):** `MONTHLY_PLACEHOLDER`, `CATEGORIES`, `STATUS_OPTIONS`, `STATUS_OPTS`, `BADGE` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ToastContext` connect `Community 0` to `Community 2`, `Community 7`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `UserProfile Page` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `AppointmentCalendar Component` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `AdminDashboard Page` (e.g. with `AdminAnalytics Page` and `AdminAppointments Page`) actually correct?**
  _`AdminDashboard Page` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MONTHLY_PLACEHOLDER`, `CATEGORIES`, `STATUS_OPTIONS` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._