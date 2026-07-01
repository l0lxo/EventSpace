const axios = require('axios');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE_URL = 'https://api.paystack.co';

const headers = () => ({
  Authorization: `Bearer ${PAYSTACK_SECRET}`,
  'Content-Type': 'application/json',
});

/**
 * Initialize a Paystack transaction.
 * Returns { authorizationUrl, accessCode, reference }
 *
 * For local development, expose the backend with ngrok so Paystack can
 * reach the webhook: npx ngrok http 5001
 */
const initializePayment = async ({ email, amount, reference, metadata }) => {
  const response = await axios.post(
    `${BASE_URL}/transaction/initialize`,
    {
      email,
      amount: Math.round(amount * 100), // Paystack accepts amounts in kobo (smallest unit)
      reference,
      metadata,
      callback_url: `${process.env.CLIENT_URL}/booking/payment-callback`,
    },
    { headers: headers() }
  );
  const { authorization_url: authorizationUrl, access_code: accessCode, reference: ref } = response.data.data;
  return { authorizationUrl, accessCode, reference: ref };
};

/**
 * Verify a Paystack transaction by reference.
 * Always verify independently — never trust the webhook payload alone,
 * as it could be replayed or forged.
 */
const verifyPayment = async (reference) => {
  const response = await axios.get(
    `${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: headers() }
  );
  return response.data.data;
};

module.exports = { initializePayment, verifyPayment };
