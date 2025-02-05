import express from 'express';
// import QR_Routes from '../routes/qr.route.js'; // Ensure .js extension
import auth from '../routes/auth.route.js'; // Ensure .js extension
import OrderRouter from '../routes/Order.route.js'; // Ensure .js extension
import cart from '../routes/cart.router.js'; // Ensure .js extension

const allRouter = express.Router();

allRouter.use('/auth', auth);
// allRouter.use('/OR', QR_Routes);
allRouter.use('/order', OrderRouter);
allRouter.use('/cart', cart);

export default allRouter;
