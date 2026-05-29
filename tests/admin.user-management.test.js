const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Cart = require('../src/models/cart.model');
const Order = require('../src/models/order.model');
const Appointment = require('../src/models/appointment.model');
const Pet = require('../src/models/pet.model');
const Review = require('../src/models/review.model');
const Product = require('../src/models/product.model');

// Minimal user factory matching required fields
const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  role: 'customer',
  ...overrides,
});

async function loginAs(agent, userData) {
  const res = await agent.post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

describe('Admin User Management Routes', () => {
  let agent;
  let adminUser;
  let adminCookie;
  let regularUser;
  const adminPassword = 'AdminPass123*';
  const userPassword = 'UserPass123*';

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    agent = request.agent(app);

    // Clean up
    await User.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Appointment.deleteMany({});
    await Pet.deleteMany({});
    await Review.deleteMany({});
    await Product.deleteMany({});

    // Create admin directly (bypass registration to set role)
    adminUser = await User.create(
      makeUser({ email: 'admin@example.com', password: adminPassword, role: 'admin' })
    );

    // Create regular user via registration
    const regRes = await request(app).post('/api/auth/register').send(
      makeUser({ email: 'regular@example.com', password: userPassword, role: 'customer' })
    );

    regularUser = await User.findOne({ email: 'regular@example.com' });

    // Login as admin
    adminCookie = await loginAs(agent, { email: 'admin@example.com', password: adminPassword });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── GET /api/admin/users ───────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('should require admin role — reject non-admin', async () => {
      const userAgent = request.agent(app);
      const userCookie = await loginAs(userAgent, {
        email: 'regular@example.com',
        password: userPassword,
      });

      const res = await userAgent
        .get('/api/admin/users')
        .set('Cookie', userCookie);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('should return paginated list of users', async () => {
      const res = await agent
        .get('/api/admin/users')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // At least admin + regular user
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toMatchObject({
        total: expect.any(Number),
        page: 1,
        pages: expect.any(Number),
      });
    });

    it('should exclude sensitive fields from response', async () => {
      const res = await agent
        .get('/api/admin/users')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const user = res.body.data[0];
      expect(user.password).toBeUndefined();
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
      expect(user.emailVerificationToken).toBeUndefined();
      expect(user.emailVerificationExpires).toBeUndefined();
    });

    it('should filter by role when role query param is provided', async () => {
      const res = await agent
        .get('/api/admin/users?role=admin')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((u) => u.role === 'admin')).toBe(true);
    });

    it('should paginate correctly', async () => {
      // Create a few extra users to test pagination
      for (let i = 0; i < 3; i++) {
        await User.create(
          makeUser({ email: `extra${i}@example.com`, password: 'Pass123*' })
        );
      }

      const res = await agent
        .get('/api/admin/users?page=1&limit=2')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  // ─── PATCH /api/admin/users/:id/role ────────────────────────────────────────

  describe('PATCH /api/admin/users/:id/role', () => {
    it('should change a user\'s role', async () => {
      const res = await agent
        .patch(`/api/admin/users/${regularUser._id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'veterinarian' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('veterinarian');
    });

    it('should prevent admin from changing their own role', async () => {
      const res = await agent
        .patch(`/api/admin/users/${adminUser._id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'customer' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBeFalsy();
    });

    it('should reject invalid roles', async () => {
      const res = await agent
        .patch(`/api/admin/users/${regularUser._id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'superuser' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await agent
        .patch(`/api/admin/users/${fakeId}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'customer' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/admin/users/:id ────────────────────────────────────────────

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete a user successfully', async () => {
      const res = await agent
        .delete(`/api/admin/users/${regularUser._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User deleted successfully');

      const deleted = await User.findById(regularUser._id);
      expect(deleted).toBeNull();
    });

    it('should cascade-delete user cart', async () => {
      // Create a cart for the regular user
      await Cart.create({ user: regularUser._id, items: [], totalItems: 0, totalAmount: 0 });

      const res = await agent
        .delete(`/api/admin/users/${regularUser._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const cart = await Cart.findOne({ user: regularUser._id });
      expect(cart).toBeNull();
    });

    it('should cascade-cancel pending appointments', async () => {
      // Create a professional user for the appointment
      const professional = await User.create(
        makeUser({
          email: 'vet@example.com',
          password: 'Pass123*',
          role: 'veterinarian',
          professionalInfo: {
            specialization: 'Surgery',
            experience: 5,
          },
        })
      );

      // Create a pet for the regular user
      const pet = await Pet.create({
        name: 'Buddy',
        breed: 'Labrador',
        age: 3,
        type: 'Dog',
        color: 'Brown',
        gender: 'male',
        owner: regularUser._id,
      });

      await Appointment.create({
        appointmentType: 'veterinarian',
        professionalName: 'Dr. Vet',
        professionalId: professional._id,
        dateTime: new Date(Date.now() + 86400000),
        petName: 'Buddy',
        petId: pet._id,
        description: 'Regular checkup for pet health',
        address: '123 Vet Street',
        status: 'PENDING',
        userId: regularUser._id,
      });

      const res = await agent
        .delete(`/api/admin/users/${regularUser._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);

      const appt = await Appointment.findOne({ userId: regularUser._id });
      expect(appt.status).toBe('CANCELLED');
    });

    it('should prevent admin from deleting themselves', async () => {
      const res = await agent
        .delete(`/api/admin/users/${adminUser._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBeFalsy();

      const stillExists = await User.findById(adminUser._id);
      expect(stillExists).not.toBeNull();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await agent
        .delete(`/api/admin/users/${fakeId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
    });
  });
});
