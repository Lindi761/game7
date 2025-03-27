const express = require('express');
const stripe = require('stripe')('your_secret_key');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// 创建支付会话
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'cny',
                    product_data: {
                        name: '游戏金币',
                        description: '1000金币',
                    },
                    unit_amount: 100, // 1元 = 100分
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 检查支付会话状态
app.get('/check-session-status', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
        res.json({
            status: session.payment_status === 'paid' ? 'complete' : 'pending'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 