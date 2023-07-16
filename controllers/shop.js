const fs = require('fs');
const path = require('path');
const Product = require('../models/product');
const Order = require('../models/order');
const PDFDocument = require('pdfkit');

exports.getProducts = (req, res, next) => {
    Product.find()
        .then(products => {
            res.render('shop/product-list', {
                prods: products,
                pageTitle: 'All Products',
                path: "/products",
                isAuthenticated: req.session.isLoggedIn
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.getIndex = (req, res, next) => {
    Product.find()
        .then(products => {
            res.render('shop/index', {
                prods: products,
                pageTitle: 'Shop',
                path: "/"
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.getProduct = (req, res, next) => {
    const prodId = req.params.productId;
    Product.findById(prodId)
        .then(product => {
            res.render('shop/product-detail', {
                product: product,
                pageTitle: product.title,
                path: '/products',
                isAuthenticated: req.session.isLoggedIn
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}


exports.getCart = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .then(user => {
            const products = user.cart.items;
            res.render('shop/cart', {
                path: '/cart',
                pageTitle: 'Your Cart',
                products: products,
                isAuthenticated: req.session.isLoggedIn
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then(product => {
            return req.user.addToCart(product);
        })
        .then(result => {
            res.redirect('/cart')
            console.log(result);
        });
};

exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId; //name is productId
    req.user
        .removeFromCart(prodId)
        .then(result => {
            res.redirect('/cart')
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.getCheckout = (req, res, next) => {
    Product.fetchAll(products => {
        res.render('shop/checkout', {
            prods: products,
            pageTitle: 'Checkout',
            path: "/checkout",
            isAuthenticated: req.session.isLoggedIn
        });
    });
}

exports.getOrders = (req, res, next) => {
    Order.find({ 'user.userId': req.user._id })
        .then(orders => {
            res.render('shop/orders.ejs', {
                pageTitle: 'Your Orders',
                path: "/orders",
                orders: orders,
                isAuthenticated: req.session.isLoggedIn
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postOrders = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .then(user => {
            const products = user.cart.items.map(i => {
                return { quantity: i.quantity, product: { ...i.productId._doc } };
            })
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user
                },
                products: products
            });
            return order.save();
        })
        .then(result => {
            return req.user.clearCart();
            res.redirect('/orders');
        })
        .then(() => {
            res.redirect('/orders');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.getInvoice = (req, res, next) => {
    const orderId = req.params.orderId;
    Order.findById(orderId)
        .then(order => {
            if (!order) {
                return next(new Error("No order found."));
            }
            if (order.user[0].userId.toString() !== req.user._id.toString()) {
                return next(new Error("Unauthorized"));
            }
            const invoiceName = 'invoice-' + orderId + '.pdf';
            const invoicePath = path.join('data', 'invoices', invoiceName);

            // fs.readFile(invoicePath, (err, data) => { - preloading Data
            //     if (err) {
            //         console.log(err);
            //         return next(err);
            //     }
            //     res.setHeader('Content-Type', 'application/pdf'); // opens in the browser
            //     res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"'); // allows to define how the content should be served to the client. (attachment)
            //     res.send(data);
            // }) for small files it is fine, node first of all access the file,
            // read entire content into memory 
            //and then return it with response. 
            //For bigger files this will take longer for responses to send
            // and your memory on the server might overflow at some point for many incoming requists.
            // SO it is not a really good practice 

            // Streaming Data

            const pdfDoc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
            pdfDoc.pipe(fs.createWriteStream(invoicePath));
            pdfDoc.pipe(res);

            pdfDoc.fontSize(26).text('Invoice', {underline: true});

            pdfDoc.text("---------------------");

            let totalPrice = 0
            order.products.forEach(prod => {
                totalPrice += prod.quantity*prod.product.price;
                pdfDoc.fontSize(14).text(prod.product.title + ": " + prod.quantity + " x " + "$" + prod.product.price)
            });
            pdfDoc.text("---------------------");
            pdfDoc.fontSize(20).text('Total Price $: ' + totalPrice);


            pdfDoc.end();

            // const file = fs.createReadStream(invoicePath);
            // res.setHeader('Content-Type', 'application/pdf'); 
            // res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"'); 
            // file.pipe(res);
        })
        .catch(err => {
            return next(err);
        })
}