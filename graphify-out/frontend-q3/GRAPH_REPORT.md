# Graph Report - frontend/src (services/context/hooks/utils/constants/models)  (2026-06-10)

## Corpus Check
- 43 files · ~11,633 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 338 nodes · 342 edges · 70 communities (18 shown, 52 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.76)
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
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
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]

## God Nodes (most connected - your core abstractions)
1. `ProductService` - 19 edges
2. `AppointmentService` - 18 edges
3. `api` - 13 edges
4. `Appointment` - 8 edges
5. `Product` - 8 edges
6. `UserProfileService` - 7 edges
7. `Pet` - 7 edges
8. `Review` - 7 edges
9. `apiClient (api instance)` - 7 edges
10. `USER_ROLES` - 7 edges

## Surprising Connections (you probably didn't know these)
- `AppointmentService` --uses--> `apiClient (api instance)`  [INFERRED]
  frontend/src/Services/localServices/appointmentService.js → frontend/src/core/api/apiClient.js
- `ProductService` --uses--> `apiClient (api instance)`  [INFERRED]
  frontend/src/Services/localServices/ProductService.js → frontend/src/core/api/apiClient.js
- `ProfessionalService` --uses--> `apiClient (api instance)`  [INFERRED]
  frontend/src/Services/localServices/professionalService.js → frontend/src/core/api/apiClient.js
- `Appointment Entity` --uses--> `APPOINTMENT_STATUS`  [INFERRED]
  frontend/src/models/entities/Appointment.js → frontend/src/constants/appointmentConstants.js
- `AppointmentCreateDTO` --references--> `Appointment Entity`  [INFERRED]
  frontend/src/models/dto/AppointmentDTO.js → frontend/src/models/entities/Appointment.js

## Hyperedges (group relationships)
- **apiClient-based API Services Layer** — authapi_authapi, paymentsapi_paymentsapi, petapi_petapi, reviewservice_reviewservice [EXTRACTED 0.95]
- **Appointment CRUD Data Flow** — useappointments_useappointments, appointmentservice_appointmentservice, apiclient_api [EXTRACTED 0.95]
- **Form Validation Pipeline** — useform_useform, validation_createvalidator, validation_validationrules [INFERRED 0.75]
- **Appointment Domain Model Layer** — entityAppointment_Appointment, appointmentDto_AppointmentCreateDTO, appointmentDto_AppointmentUpdateDTO, appointmentDto_AppointmentFilterDTO, appointmentTypes_AppointmentInterface, appointmentConstants_APPOINTMENT_STATUS [INFERRED 0.90]
- **User Role-Based Access Control System** — userConstants_USER_ROLES, userConstants_PERMISSIONS, userConstants_ROLE_PERMISSIONS, userConstants_hasPermission, userConstants_isProfessional, entityUser_User [INFERRED 0.85]
- **Product and Review Entity Cluster** — entityProduct_Product, entityReview_Review, productDto_ProductCreateDTO, productDto_ProductUpdateDTO, productDto_ProductFilterDTO [INFERRED 0.85]
- **Auth Modal Flow (SignUpDropdown orchestrates Login and SignUp modals)** — signupdropdown_SignUpDropdown, signupmodal_SignUpModal, authcontext_AuthContext, toastcontext_ToastContext [EXTRACTED 0.95]
- **RichText Editor System (Editor, Toolbar, Extensions, Renderer)** — richtexteditor_RichTextEditor, toolbar_Toolbar, extensions_buildExtensions, extensions_TOOLBAR_GROUPS, richtextrenderer_RichTextRenderer, richtext_index [EXTRACTED 1.00]
- **UserProfile Modal Components** — confirmmodal_ConfirmModal, passwordchangeform_PasswordChangeForm, petform_PetForm, petlist_PetList, profileform_ProfileForm [INFERRED 0.85]
- **Shadcn/Radix UI Primitives** — accordion_Accordion, button_Button, card_Card, carousel_Carousel, input_Input, label_Label, separator_Separator, tabs_Tabs [INFERRED 0.90]

## Communities (70 total, 52 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (11): AppointmentCreateDTO, AppointmentFilterDTO, AppointmentUpdateDTO, LoginDTO, PasswordChangeDTO, PasswordResetDTO, SignupDTO, ProductCreateDTO (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (17): api, apiClient, token, appointmentsApi, authApi, cartApi, inventoryApi, invoiceApi (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (14): hasAnyRole(), hasPermission(), hasRole(), isAdmin(), isProfessional(), PERMISSIONS, PROFESSIONAL_ROLES, ROLE_DISPLAY_NAMES (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (16): APPOINTMENT_DURATIONS, APPOINTMENT_STATUS, AppointmentCreateDTO, AppointmentUpdateDTO, AppointmentFormData Interface, Appointment Interface, AppointmentStatus Type, AppointmentType Type (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): Appointment, AppointmentCalendarProps, AppointmentCardProps, AppointmentFormData, AppointmentFormProps, AppointmentRole, AppointmentStatus, AppointmentType (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (11): PERMISSIONS, PROFESSIONAL_ROLES, ROLE_DISPLAY_NAMES, ROLE_PERMISSIONS, USER_ROLES, hasAnyRole, hasPermission, hasRole (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (10): apiClient (api instance), AppointmentService, authApi, AuthService (re-export), paymentsApi, petApi, ProductService, ProfessionalService (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.31
Nodes (5): detectCurrency(), FALLBACK_RATES, fetchRates(), SUPPORTED_CURRENCIES, CurrencyContext

### Community 15 - "Community 15"
Cohesion: 0.60
Nodes (6): TOOLBAR_GROUPS, buildExtensions, RichText Index (barrel), RichTextEditor, RichTextRenderer, Toolbar

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (3): commonValidations, validationMessages, validationRules

### Community 17 - "Community 17"
Cohesion: 0.40
Nodes (4): APPOINTMENT_DURATIONS, APPOINTMENT_STATUS, APPOINTMENT_TYPES, TIME_SLOTS

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (4): AuthContext, SignUpDropdown, SignUpModal, ToastContext

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (4): useForm hook, createValidator, validationMessages, validationRules

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): Button, Carousel, CarouselContext

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (3): ConfirmModal, PetForm, PetList

## Knowledge Gaps
- **118 isolated node(s):** `appointmentsApi`, `authApi`, `cartApi`, `FALLBACK_RATES`, `inventoryApi` (+113 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `appointmentsApi`, `authApi`, `cartApi` to the rest of the system?**
  _118 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.056025369978858354 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06747638326585695 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._