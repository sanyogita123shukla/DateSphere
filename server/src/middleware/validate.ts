import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Runs validation and returns 422 with structured field errors.
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors: Record<string, string> = {};
    errors.array().forEach((err) => {
      if (err.type === 'field') {
        fieldErrors[err.path] = err.msg;
      }
    });

    res.status(422).json({
      success: false,
      error: 'Validation failed. Please check your input.',
      code: 'VALIDATION_ERROR',
      fields: fieldErrors,
    });
    return;
  }
  next();
}

// ─── Validation Chains ────────────────────────────────────────

export const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 4, max: 128 })
    .withMessage('Password must be at least 4 characters'),
  body('display_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name is required (max 50 characters)'),
  body('bio')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Bio must be 10-1000 characters — tell us about yourself!'),
  body('cultural_id')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cultural ID must be under 100 characters'),
  body('interests')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Interests must be under 500 characters'),
  handleValidationErrors,
];

export const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

export const validateUpdateProfile = [
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('display_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be 1-50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Bio must be 10-1000 characters'),
  body('cultural_id')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cultural ID must be under 100 characters'),
  body('interests')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  handleValidationErrors,
];

export const validateConnectionRequest = [
  body('user_b_id')
    .isInt({ min: 1 })
    .withMessage('Target user ID is required'),
  handleValidationErrors,
];

export const validateConnectionAction = [
  body('connection_id')
    .isInt({ min: 1 })
    .withMessage('Connection ID is required'),
  handleValidationErrors,
];

export const validateMessage = [
  body('connection_id')
    .isInt({ min: 1 })
    .withMessage('Connection ID is required'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be 1-5000 characters'),
  handleValidationErrors,
];

export const validateParamId = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  handleValidationErrors,
];

export const validateParamUserId = [
  param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  handleValidationErrors,
];

export const validateParamConnectionId = [
  param('connectionId').isInt({ min: 1 }).withMessage('Invalid connection ID'),
  handleValidationErrors,
];
