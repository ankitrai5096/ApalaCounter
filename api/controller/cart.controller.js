
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import Product from "../model/product.model.js";
import Offline_CartItem from "../model/cartItem.model.js";
import Offline_Cart from "../model/cart.model.js";
import counter from "../model/user.model.js";

const addToCart = asyncHandler(async (req, res) => {
    const { id } = req.user; 
    const { productCode } = req.body; 
    const user = await counter.findById(id); 
    if (!user) {
        return res.status(401).json(new ApiResponse(401, 'User not found', null)); 
    }

    try {
        const product = await Product.findOne({ BarCode: productCode });
        if (!product) {
            return res.status(404).json(new ApiResponse(404, 'Product not found', null)); 
        }

        let cartItem = await Offline_CartItem.findOne({ userId: id, product: product._id });
        if (cartItem) {
            cartItem.quantity += 1;
            cartItem.price += product.price;
            cartItem.discountedPrice += product.discountedPrice;
            cartItem.GST += product.GST;
            cartItem.finalPrice_with_GST += (product.discountedPrice + product.GST);
            cartItem.updatedAt = new Date();
            await cartItem.save();
        } else {
            cartItem = await Offline_CartItem.create({
                quantity: 1,
                price: product.price,
                discountedPrice: product.discountedPrice,
                userId: id,
                GST: product.GST, 
                finalPrice_with_GST: product.discountedPrice + product.GST,
                product: product._id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        let cart = await Offline_Cart.findOne({ userId: id });
        if (!cart) {
            cart = await Offline_Cart.create({
                userId: id,
                cartItems: [cartItem._id],
                totalPrice: cartItem.price,
                totalItem: 1,
                GST: cartItem.GST, 
                final_price_With_GST: cartItem.finalPrice_with_GST,
                totalDiscountedPrice: cartItem.discountedPrice,
                discount: cartItem.price - cartItem.discountedPrice,
            });
        } else {
            if (!cart.cartItems.includes(cartItem._id)) {
                cart.cartItems.push(cartItem._id);
                cart.totalItem += 1;
            }
            cart.GST += cartItem.GST;
            cart.final_price_With_GST += cartItem.finalPrice_with_GST;
            cart.totalPrice += product.price;
            cart.totalDiscountedPrice += product.discountedPrice;
            cart.discount += (product.price - product.discountedPrice);
            await cart.save();
        }
        return res.status(200).json(new ApiResponse(200, 'Product added to cart successfully', { cartItem, cart })); 
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message }); 
    }
});

const getCartDetails = asyncHandler(async (req, res) => {
    const { id } = req.user;
      console.log(id);
    if (!id) {
        return res.status(401).json(new ApiResponse(401, 'User ID not provided in cookies', null));
    }

    const user = await counter.findById(id);

    if (!user) {
        return res.status(401).json(new ApiResponse(401, 'User not found', null));
    }

    try {
        const cart = await Offline_Cart.findOne({ userId: id }).populate({
            path: 'cartItems',
            populate: {
                path: 'product',
                model: 'products'
            }
        });

        if (!cart) {
            return res.status(404).json(new ApiResponse(404, 'Cart is empty for this user', null));
        }

        return res.status(200).json(new ApiResponse(200, 'Cart retrieved successfully', cart));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, error.message, null));
    }
});

const getCartItemsById = asyncHandler(async (req, res) => {
    const { id } = req.user; 
    const { productQR } = req.query;

    const user = await counter.findById(id);

    if (!user) {
        return res.status(401).json(new ApiError(401, 'User not found'));
    }

    try {
        const product = await Product.findOne({ BarCode: productQR });

        if (!product) {
            return res.status(404).json(new ApiResponse(404, 'Product not found', null));
        }

        return res.status(200).json(new ApiResponse(200, 'Cart item retrieved successfully', product));
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

const removeOneCart = asyncHandler(async (req, res) => {
    const { id } = req.user; 
    const { itemId } = req.query;

    const user = await counter.findById(id);

    if (!user) {
        return res.status(401).json(new ApiError(401, 'User not found'));
    }

    try {
        const cartItem = await Offline_CartItem.findById({ _id: itemId });

        if (!cartItem) {
            return res.status(404).json(new ApiResponse(404, 'Cart item not found', null));
        } else {
            if (cartItem.userId.toString() !== id) {
                return res.status(403).json(new ApiResponse(403, 'Unauthorized to delete this cart item', null));
            }
        }

        let cart = await Offline_Cart.findOne({ userId: id });
        const cartItemExists = cart.cartItems.some(item => item.toString() === cartItem._id.toString());
        if (cartItem.quantity > 0 && cartItemExists) { 
            cart.cartItems.pull(cartItem._id);
            cart.totalPrice -= cartItem.price;
            cart.totalItem -= 1;
            cart.totalDiscountedPrice -= cartItem.discountedPrice;
            cart.GST -= cartItem.GST;
            cart.final_price_With_GST -= cartItem.finalPrice_with_GST;
            cart.discount -= (cartItem.price - cartItem.discountedPrice);
            await cart.save();
            await Offline_CartItem.findByIdAndRemove({ _id: itemId });
        }

        return res.status(200).json(new ApiResponse(200, 'Cart item deleted successfully', cartItem));
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

const removeAllCart = asyncHandler(async (req, res) => {
    const { id } = req.user; 

    const user = await counter.findById(id);
    if (!user) {
        return res.status(401).json(new ApiError(401, 'User not found'));
    }

    try {
        const cart = await Offline_Cart.findOne({ userId: id });
        if (!cart) {
            return res.status(404).json(new ApiResponse(404, 'Cart not found'));
        }

        await Offline_CartItem.deleteMany({ _id: { $in: cart.cartItems } });
        await Offline_Cart.findOneAndRemove({ userId: id });

        return res.status(200).json(new ApiResponse(200, 'Cart deleted successfully'));
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

const removeItemQuantityCart = asyncHandler(async (req, res) => {
    const { id } = req.user; 
    const { itemId } = req.query;

    const user = await counter.findById(id);

    if (!user) {
        return res.status(401).json(new ApiError(401, 'User not found'));
    }

    try {
        const cartItem = await Offline_CartItem.findById({ _id: itemId });

        if (!cartItem) {
            return res.status(404).json(new ApiResponse(404, 'Cart item not found', null));
        } else {
            if (cartItem.userId.toString() !== id) {
                return res.status(403).json(new ApiResponse(403, 'Unauthorized to delete this cart item', null));
            }
        }

        const productId = cartItem.product;
        const product = await Product.findById({ _id: productId });
        if (cartItem.quantity > 1) {
            cartItem.quantity -= 1;
            cartItem.price -= product.price;
            cartItem.GST -= product.GST;
            cartItem.finalPrice_with_GST -= (product.discountedPrice + product.GST);
            cartItem.discountedPrice -= product.discountedPrice;
            cartItem.updatedAt = new Date();
            await cartItem.save();

            let cart = await Offline_Cart.findOne({ userId: id });
            const cartItemExists = cart.cartItems.some(item => item.toString() === cartItem._id.toString());
            if (cart && cartItemExists) {
                cart.totalPrice -= product.price;
                cart.GST -= product.GST;
                cart.final_price_With_GST -= (product.discountedPrice - product.GST);
                cart.totalDiscountedPrice -= product.discountedPrice;
                cart.discount -= (product.price - product.discountedPrice);
                await cart.save();
            }

            return res.status(200).json(new ApiResponse(200, 'Cart item quantity decreased successfully', cartItem));
        } else {
            return res.status(400).json(new ApiResponse(400, 'Minimum quantity reached for this item', null));
        } 
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export {
    addToCart,
    getCartDetails,
    getCartItemsById,
    removeOneCart,
    removeAllCart,
    removeItemQuantityCart,
};
