# Graph Report - frontend/src/Components  (2026-06-10)

## Corpus Check
- Corpus is ~17,785 words - fits in a single context window. You may not need a graph.

## Summary
- 261 nodes · 232 edges · 63 communities (33 shown, 30 thin omitted)
- Extraction: 92% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]

## God Nodes (most connected - your core abstractions)
1. `ProfessionalCalendar` - 7 edges
2. `ProfessionalList` - 7 edges
3. `AppointmentForm` - 6 edges
4. `NavigationBar` - 6 edges
5. `ToastContext` - 6 edges
6. `AppointmentErrorBoundary` - 5 edges
7. `ErrorBoundary` - 5 edges
8. `CartModal` - 5 edges
9. `LoginModal` - 5 edges
10. `CartContext` - 5 edges

## Surprising Connections (you probably didn't know these)
- `SearchBar` --conceptually_related_to--> `CartContext`  [AMBIGUOUS]
  frontend/src/Components/HelperComponents/SearchBar/SearchBar.jsx → frontend/src/context/CartContext.jsx
- `AppointmentErrorBoundary` --conceptually_related_to--> `AppointmentForm`  [INFERRED]
  frontend/src/Components/ErrorBoundary.jsx → frontend/src/Components/HelperComponents/AppointmentForm/AppointmentForm.jsx
- `ProfessionalCalendar` --calls--> `AppointmentForm`  [INFERRED]
  frontend/src/Components/ProfessionalCalendar.jsx → frontend/src/Components/HelperComponents/AppointmentForm/AppointmentForm.jsx
- `AuthField` --semantically_similar_to--> `FormInput`  [INFERRED] [semantically similar]
  frontend/src/Components/Auth/AuthField.jsx → frontend/src/Components/Common/FormInput/FormInput.jsx
- `AppointmentCard` --conceptually_related_to--> `AppointmentForm`  [INFERRED]
  frontend/src/Components/HelperComponents/AppointmentCard/AppointmentCard.jsx → frontend/src/Components/HelperComponents/AppointmentForm/AppointmentForm.jsx

## Hyperedges (group relationships)
- **Auth Guard Components** — protectedroute_protectedroute, rolebasedroute_rolebasedroute, context_authcontext [EXTRACTED 0.95]
- **Auth Modal System** — authmodal_authmodal, authfield_authfield, forgotpasswordmodal_forgotpasswordmodal, resetpassword_resetpassword [INFERRED 0.85]
- **Appointment UI Components** — appointmentcard_appointmentcard, appointmentform_appointmentform, errorboundary_appointmenterrorboundary, professionalcalendar_professionalcalendar [INFERRED 0.80]
- **Admin Panel Components** — adminlayout_adminlayout, datatable_datatable, context_authcontext [INFERRED 0.85]
- **Cart and Checkout Components** — cartitem_cartitem, cartmodalcomponent_cartmodalcomponent, checkoutstepper_checkoutstepper, helpercomponents_price [INFERRED 0.80]
- **Cart Management Flow** — addtocart_AddToCart, cartmodal_CartModal, context_CartContext, cartitem_CartItem, price_Price [EXTRACTED 0.95]
- **Professional Booking Flow** — professionallist_ProfessionalList, professionalcard_ProfessionalCard, professionalcalendar_ProfessionalCalendar, appointmentform_AppointmentForm, api_professionalsApi, api_appointmentsApi [EXTRACTED 0.95]
- **Product Review Flow** — productreviewcard_ProductReviewCard, productreviewformmodal_ProductReviewFormModal, api_productsApi, context_AuthContext [EXTRACTED 0.90]
- **NavigationBar Composition** — navigationbar_NavigationBar, addtocart_AddToCart, servicesdropdown_ServicesDropdown, currencyselector_CurrencySelector, signupdropdown_SignUpDropdown, context_AuthContext [EXTRACTED 0.95]
- **Authentication Modal Flow** — loginmodal_LoginModal, auth_AuthModal, auth_AuthField, auth_ForgotPasswordModal, context_AuthContext, context_ToastContext [EXTRACTED 0.95]
- **Toast Context Consumers** — productcardv2_ProductCardV2, addtocart_AddToCart, cartmodal_CartModal, professionallist_ProfessionalList, professionalcalendar_ProfessionalCalendar, loginmodal_LoginModal [EXTRACTED 0.90]
- **Auth Modal Flow (SignUpDropdown orchestrates Login and SignUp modals)** — signupdropdown_SignUpDropdown, signupmodal_SignUpModal, authcontext_AuthContext, toastcontext_ToastContext [EXTRACTED 0.95]
- **RichText Editor System (Editor, Toolbar, Extensions, Renderer)** — richtexteditor_RichTextEditor, toolbar_Toolbar, extensions_buildExtensions, extensions_TOOLBAR_GROUPS, richtextrenderer_RichTextRenderer, richtext_index [EXTRACTED 1.00]
- **UserProfile Modal Components** — confirmmodal_ConfirmModal, passwordchangeform_PasswordChangeForm, petform_PetForm, petlist_PetList, profileform_ProfileForm [INFERRED 0.85]
- **Shadcn/Radix UI Primitives** — accordion_Accordion, button_Button, card_Card, carousel_Carousel, input_Input, label_Label, separator_Separator, tabs_Tabs [INFERRED 0.90]

## Communities (63 total, 30 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (21): AddToCart, appointmentsApi, professionalsApi, AppointmentForm, CartItem, CartModal, CartContext, CurrencyContext (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (8): buildExtensions(), linkConfig, textAlignConfig, TOOLBAR_GROUPS, RichTextEditor(), PURIFY_CONFIG, RichTextRenderer(), sanitize()

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (16): productsApi, AuthField, AuthModal, ForgotPasswordModal, AuthContext, AuthContext, CurrencySelector, ErrorBoundary (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (4): btnSpring, CartItem(), ProductCardV2(), stripHtml()

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (3): SERVICE_ITEMS, MOBILE_SERVICE_ITEMS, NAV_LINKS

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (8): Button, buttonVariants, Carousel, CarouselContent, CarouselContext, CarouselItem, CarouselNext, CarouselPrevious

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): AppointmentCard, AppointmentForm, ToastContext, AppointmentErrorBoundary, ProfessionalCalendar, appointmentsApi, usersApi

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (7): AdminLayout, AuthContext, GlobalToastContext, DataTable, LoadingSpinner, ProtectedRoute, RoleBasedRoute

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 13 - "Community 13"
Cohesion: 0.60
Nodes (6): TOOLBAR_GROUPS, buildExtensions, RichText Index (barrel), RichTextEditor, RichTextRenderer, Toolbar

### Community 15 - "Community 15"
Cohesion: 0.40
Nodes (5): AuthField, AuthModal, ForgotPasswordModal, FormInput, ResetPassword

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 18 - "Community 18"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (3): Button, Carousel, CarouselContext

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): ConfirmModal, PetForm, PetList

## Ambiguous Edges - Review These
- `SearchBar` → `CartContext`  [AMBIGUOUS]
  frontend/src/Components/HelperComponents/SearchBar/SearchBar.jsx · relation: conceptually_related_to

## Knowledge Gaps
- **96 isolated node(s):** `LINKS`, `btnSpring`, `STEPS`, `STAR_LABELS`, `PROFESSIONAL_CONFIGS` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SearchBar` and `CartContext`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `NavigationBar` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `ToastContext` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `AuthContext` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AppointmentForm` (e.g. with `AppointmentCard` and `AppointmentErrorBoundary`) actually correct?**
  _`AppointmentForm` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LINKS`, `btnSpring`, `STEPS` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12857142857142856 - nodes in this community are weakly interconnected._