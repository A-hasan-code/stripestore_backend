const jwt = require('jsonwebtoken');

const sendToken = (User, statusCode, res) => {
    const token = User.getJwTToken()
    const options = {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: "none",
        secure: true,
    };
    res.cookie("token", token, options).json({
        success: true,
        User,
        token,
    })
}
module.exports = sendToken
