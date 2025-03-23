const express = require('express');
const stripe = require('stripe')('your_stripe_secret_key');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// 检查支付状态
app.post('/check-payment-status', async (req, res) => {
    try {
        const { session_id } = req.body;
        
        // 获取支付会话信息
        const session = await stripe.checkout.sessions.retrieve(session_id);
        
        // 检查支付状态
        if (session.payment_status === 'paid') {
            res.json({ status: 'success' });
        } else {
            res.json({ status: 'pending' });
        }
    } catch (error) {
        console.error('支付状态检查错误:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Stripe webhook处理
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, 'your_webhook_secret');
    } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // 处理支付成功事件
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        // 在这里可以添加更多的支付成功处理逻辑
        console.log('支付成功:', session);
    }

    res.json({received: true});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 