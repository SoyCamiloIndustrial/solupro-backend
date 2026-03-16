app.post('/webhook-wompi', async (req, res) => {
    const { data } = req.body;
    if (data?.transaction?.status === 'APPROVED') {
        const email = data.transaction.customer_email;
        const tempPass = Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(tempPass, 10);
        
        try {
            // USAMOS "password" que es como se llama tu columna real
            await pool.query(
                'INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2',
                [email, hash]
            );

            await resend.emails.send({
                from: 'SoluPro <onboarding@resend.dev>',
                to: email,
                subject: '¡Bienvenido a tu curso de Excel!',
                html: `<p>Tu acceso ha sido creado.</p><p>Contraseña temporal: <strong>${tempPass}</strong></p>`
            });
            console.log("📧 Email enviado y usuario creado para:", email);
            res.status(200).send('OK');
        } catch (e) {
            console.error("❌ Error en webhook:", e.message);
            res.status(500).send('Error');
        }
    } else {
        res.status(200).send('No aprobado');
    }
});