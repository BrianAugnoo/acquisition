import express from 'express';
import { signup, signIn, signOut } from '../controller/auth.controller.js';

const router = express.Router();

router.post('/sign-up', signup);
router.post('/login', signIn);
router.post('/logout', signOut);

export default router;
