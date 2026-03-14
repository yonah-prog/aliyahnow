module.exports = function handler(req, res) {
  return res.status(200).json({
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyPrefix: process.env.ANTHROPIC_API_KEY
      ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...'
      : null,
    nodeEnv: process.env.NODE_ENV,
  });
};
