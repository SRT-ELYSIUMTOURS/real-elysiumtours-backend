"use strict";

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { ERROR_CODES } = require("../../utils/constants");
const { MoleculerClientError } = require("moleculer").Errors;

const SALT_ROUNDS = 12;

module.exports = {
	methods: {
		/**
		 * Generate a JWT access token for the given user.
		 * @param {Object} user - User document
		 * @returns {string} Signed JWT
		 */
		generateAccessToken(user) {
			return jwt.sign(
				{
					id: user._id,
					email: user.email,
					role: user.role,
					organizationId: user.organizationId || null,
				},
				process.env.JWT_SECRET,
				{ expiresIn: process.env.JWT_EXPIRY || "1h" }
			);
		},

		/**
		 * Generate a JWT refresh token for the given user.
		 * @param {Object} user - User document
		 * @returns {string} Signed JWT
		 */
		generateRefreshToken(user) {
			return jwt.sign(
				{
					id: user._id,
					type: "refresh",
					organizationId: user.organizationId || null,
				},
				process.env.JWT_SECRET,
				{ expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
			);
		},

		/**
		 * Verify and decode a JWT token.
		 * @param {string} token - JWT string
		 * @returns {Object} Decoded payload
		 * @throws {MoleculerClientError} TOKEN_INVALID or TOKEN_EXPIRED
		 */
		verifyToken(token) {
			try {
				return jwt.verify(token, process.env.JWT_SECRET);
			} catch (err) {
				if (err.name === "TokenExpiredError") {
					throw new MoleculerClientError(
						"Token has expired.",
						401,
						ERROR_CODES.TOKEN_EXPIRED
					);
				}
				throw new MoleculerClientError(
					"Invalid token.",
					401,
					ERROR_CODES.TOKEN_INVALID
				);
			}
		},

		/**
		 * Hash a plain-text password with bcrypt.
		 * @param {string} password - Plain-text password
		 * @returns {Promise<string>} Hashed password
		 */
		async hashPassword(password) {
			return bcrypt.hash(password, SALT_ROUNDS);
		},

		/**
		 * Compare a plain-text password against a bcrypt hash.
		 * @param {string} plaintext - Plain-text password
		 * @param {string} hashed - Bcrypt hash
		 * @returns {Promise<boolean>}
		 */
		async comparePassword(plaintext, hashed) {
			return bcrypt.compare(plaintext, hashed);
		},

		/**
		 * Generate a cryptographically-secure 6-digit OTP.
		 * @returns {string} 6-digit string
		 */
		generateOTP() {
			const num = crypto.randomInt(0, 1000000);
			return num.toString().padStart(6, "0");
		},

		/**
		 * Check whether an OTP expiry timestamp has passed.
		 * @param {Date} otpExpiry
		 * @returns {boolean} true if expired
		 */
		isOTPExpired(otpExpiry) {
			return new Date(otpExpiry) < Date.now();
		},
	},
};
