# Pet Store Backend Refactoring Guide

## Overview

This document outlines the major refactoring performed to unify the User and Professional models into a single, cohesive User model. This change eliminates data duplication, improves consistency, and follows SOLID principles.

## What Changed

### 1. Model Unification

**Before:**

- Separate `User` model for customers
- Separate `Professional` model for service providers
- Potential data inconsistency and duplication

**After:**

- Single `User` model that handles both customers and professionals
- Professional-specific data stored in `professionalInfo` subdocument
- Role-based differentiation using the `role` field

### 2. New User Model Structure

```javascript
{
  // Base user fields (for all users)
  name: String,
  email: String,
  phoneNumber: String,
  address: String,
  password: String,
  role: ['customer', 'veterinarian', 'groomer', 'trainer', 'admin'],
  isEmailVerified: Boolean,

  // Professional-specific fields (only for professional roles)
  professionalInfo: {
    specialization: String,
    qualifications: [String],
    experience: Number,
    rating: Number,
    reviewCount: Number,
    profileImage: String,
    availability: Map,
    isActive: Boolean,
    bio: String,
    services: [{
      name: String,
      price: Number,
      duration: Number,
      description: String
    }],
    location: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }
  }
}
```

### 3. Service Layer Architecture

Following SOLID principles, we've introduced service layers:

#### ProfessionalService

- Handles all professional-related business logic
- Provides methods for filtering, updating, and managing professionals
- Encapsulates complex queries and operations

#### UserService

- Manages user creation, updates, and authentication
- Handles both customer and professional user operations
- Provides unified user management interface

### 4. Updated Controllers

#### ProfessionalController

- Now uses `ProfessionalService` for business logic
- Cleaner, more focused controller methods
- Better error handling and response formatting

#### AppointmentController

- Updated to work with unified User model
- Improved authorization logic
- Better professional validation

### 5. Enhanced Routes

#### Professional Routes

- Removed create/delete operations (handled through user system)
- Added professional self-management endpoints
- Improved authorization with role-based access

#### Appointment Routes

- Updated parameter names for consistency
- Added proper role-based authorization
- Cleaner route structure

## Benefits of the Refactoring

### 1. SOLID Principles Compliance

**Single Responsibility Principle (SRP):**

- Each service class has a single, well-defined responsibility
- Controllers focus only on HTTP request/response handling

**Open/Closed Principle (OCP):**

- Services can be extended without modifying existing code
- New professional types can be added easily

**Liskov Substitution Principle (LSP):**

- User objects can be treated uniformly regardless of role
- Professional-specific behavior is properly encapsulated

**Interface Segregation Principle (ISP):**

- Services provide focused, role-specific interfaces
- Clients only depend on methods they actually use

**Dependency Inversion Principle (DIP):**

- Controllers depend on service abstractions
- Business logic is decoupled from HTTP concerns

### 2. Data Consistency

- Single source of truth for user information
- No more synchronization issues between User and Professional data
- Referential integrity maintained through single model

### 3. Simplified Queries

- No more complex joins between User and Professional collections
- Easier filtering and searching across all user types
- Better performance with proper indexing

### 4. Extensibility

- Easy to add new professional roles
- Simple to extend professional information
- Flexible service pricing and availability system

## Migration Guide

### 1. Database Migration

Run the migration script to convert existing data:

```bash
node src/utils/migrateProfessionals.js
```

This script will:

- Convert existing Professional documents to User documents
- Update appointment references
- Backup old data for safety

### 2. API Changes

#### Professional Endpoints

**Old:**

```
POST /api/professionals          # Create professional
DELETE /api/professionals/:id    # Delete professional
```

**New:**

```
POST /api/auth/register          # Register as professional (with role)
PATCH /api/professionals/:id/profile    # Update professional profile
PATCH /api/professionals/:id/status     # Toggle active status
```

#### Appointment Endpoints

**Old:**

```
GET /api/appointments/:id
PATCH /api/appointments/:id/status
```

**New:**

```
GET /api/appointments/:appointmentId
PATCH /api/appointments/:appointmentId/status
```

### 3. Frontend Integration

Update your frontend code to:

1. **Registration:** Include `professionalInfo` when registering professionals
2. **Profile Management:** Use unified user profile endpoints
3. **Professional Listings:** Use new filtering parameters
4. **Appointments:** Update parameter names in API calls

## API Examples

### Register a Professional

```javascript
POST /api/auth/register
{
  "name": "Dr. John Smith",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "address": "123 Main St, City, State",
  "password": "securePassword123",
  "role": "veterinarian",
  "professionalInfo": {
    "specialization": "Small Animal Medicine",
    "qualifications": ["DVM", "Board Certified"],
    "experience": 10,
    "bio": "Experienced veterinarian specializing in small animals",
    "services": [
      {
        "name": "General Checkup",
        "price": 75,
        "duration": 30,
        "description": "Comprehensive health examination"
      }
    ]
  }
}
```

### Get Professionals with Filtering

```javascript
GET /api/professionals?role=veterinarian&rating=4&city=NewYork&page=1&limit=10
```

### Update Professional Availability

```javascript
PATCH /api/professionals/:id/availability
{
  "availability": {
    "monday": {
      "startTime": "09:00",
      "endTime": "17:00",
      "isAvailable": true
    },
    "tuesday": {
      "startTime": "09:00",
      "endTime": "17:00",
      "isAvailable": true
    }
  }
}
```

## Testing

### Unit Tests

- Test service layer methods independently
- Mock database operations for faster tests
- Validate business logic without HTTP concerns

### Integration Tests

- Test complete API workflows
- Validate data consistency across operations
- Test role-based authorization

### Migration Tests

- Verify data migration accuracy
- Test backward compatibility during transition
- Validate appointment reference updates

## Performance Considerations

### Indexing

The new model includes optimized indexes:

```javascript
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ 'professionalInfo.specialization': 1 });
userSchema.index({ 'professionalInfo.rating': -1 });
userSchema.index({ 'professionalInfo.isActive': 1 });
```

### Query Optimization

- Use projection to limit returned fields
- Leverage MongoDB aggregation for complex queries
- Implement proper pagination for large datasets

## Security Enhancements

### Role-Based Access Control

- Middleware validates user roles for protected endpoints
- Professional-specific operations require appropriate roles
- Admin operations properly restricted

### Data Validation

- Comprehensive input validation using Joi schemas
- Professional info validation based on role
- Sanitization of user inputs
- **MongoDB ObjectId Validation**: All controllers now validate ObjectIds before database operations
- **Comprehensive Validation Utils**: Centralized validation utilities for consistent data validation

### MongoDB Guidelines Compliance

- All `_id` fields use proper MongoDB ObjectId format
- ObjectId validation in all controllers and services
- Proper error handling for invalid ObjectId formats
- Consistent ObjectId usage across the application

## Monitoring and Logging

### Service Layer Logging

- Log business logic operations
- Track professional status changes
- Monitor appointment creation and updates

### Error Handling

- Centralized error handling in services
- Proper HTTP status codes
- Detailed error messages for debugging

## Future Enhancements

### Planned Features

1. **Advanced Availability Management**

   - Recurring schedules
   - Holiday management
   - Time zone support

2. **Enhanced Professional Profiles**

   - Portfolio/gallery support
   - Client testimonials
   - Certification verification

3. **Analytics and Reporting**
   - Professional performance metrics
   - Appointment analytics
   - Revenue tracking

### Scalability Considerations

- Consider database sharding for large user bases
- Implement caching for frequently accessed professional data
- Add search indexing for better professional discovery

## Conclusion

This refactoring significantly improves the codebase by:

- Eliminating data duplication and inconsistency
- Following SOLID principles for better maintainability
- Providing a more flexible and extensible architecture
- Improving API consistency and usability

The unified User model provides a solid foundation for future enhancements while maintaining backward compatibility through proper migration strategies.
