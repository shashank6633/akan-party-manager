const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');

const router = express.Router();

// JWT token expiry
const TOKEN_EXPIRY = '24h';

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token.
 */
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user in the Users sheet
      const user = await sheetsService.findUser(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      // Record last login
      const loginCount = parseInt(user.loginCount || '0', 10) + 1;
      const lastLogin = new Date().toISOString();
      sheetsService.updateUser(user._rowIndex, { lastLogin, loginCount: String(loginCount) }).catch((err) => {
        console.error('Failed to update last login:', err.message);
      });

      // Generate JWT
      const payload = {
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        rowIndex: user._rowIndex,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: TOKEN_EXPIRY,
      });

      res.json({
        success: true,
        token,
        user: {
          username: user.username,
          role: user.role,
          name: user.name,
          email: user.email,
          lastLogin,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error during login.' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user info.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await sheetsService.findUser(req.user.username);
    res.json({
      success: true,
      user: {
        username: req.user.username,
        role: req.user.role,
        name: req.user.name,
        email: req.user.email || user?.email || '',
        lastLogin: user?.lastLogin || '',
        loginCount: user?.loginCount || '0',
        createdAt: user?.createdAt || '',
      },
    });
  } catch {
    res.json({
      success: true,
      user: {
        username: req.user.username,
        role: req.user.role,
        name: req.user.name,
        email: req.user.email,
      },
    });
  }
});

/**
 * PUT /api/auth/change-password
 * Change current user's password.
 */
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await sheetsService.findUser(req.user.username);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await sheetsService.updateUser(user._rowIndex, { password: hashedPassword });

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
  }
);

/**
 * POST /api/auth/register
 * Create a new user (ADMIN only).
 */
router.post(
  '/register',
  authenticate,
  roleCheck(ROLES.ADMIN),
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('role')
      .trim()
      .notEmpty()
      .withMessage('Role is required')
      .isIn(Object.values(ROLES))
      .withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, password, role, name, email } = req.body;

      // Check if username already exists
      const existing = await sheetsService.findUser(username);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Username already exists.',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      await sheetsService.appendUser({
        username,
        password: hashedPassword,
        role: role.toUpperCase(),
        name,
        email: email || '',
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully.',
        user: { username, role: role.toUpperCase(), name, email },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
  }
);

/**
 * GET /api/auth/users
 * List all users (ADMIN only). Passwords are excluded.
 */
router.get(
  '/users',
  authenticate,
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    try {
      const users = await sheetsService.getAllUsers();
      const sanitized = users.map(({ password, _rowIndex, ...rest }) => rest);
      res.json({ success: true, users: sanitized });
    } catch (err) {
      console.error('List users error:', err);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

/**
 * Ensure the default admin account exists on first run.
 * Called during server startup.
 */
async function ensureDefaultAdmin() {
  try {
    await sheetsService.ensureUsersSheet();

    const admin = await sheetsService.findUser('admin');
    if (!admin) {
      console.log('Creating default admin account...');
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await sheetsService.appendUser({
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Administrator',
        email: process.env.ADMIN_EMAIL || '',
      });
      console.log('Default admin account created (admin / admin123).');
    }
  } catch (err) {
    console.error('Failed to ensure default admin:', err.message);
  }
}

module.exports = router;
module.exports.ensureDefaultAdmin = ensureDefaultAdmin;
