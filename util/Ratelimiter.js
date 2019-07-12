/**
 * The Ratellimter class for handling ratelimits and the ratelimiter middleware
 * @extends {Map<string, number>}
 */
class Ratelimiter extends Map {

    /**
     * @typedef {Object} RatelimiterOptions
     * @property {number} [duration=1000] The amount of time the person has to hit the max number of requests in milliseconds
     * @property {number} [max=120] Numbers of requests per key
     * @property {number} [statusCode=429] The statuscode to set when ratelimit is hit
     * @property {string} [message="You twat, stop spamming the api."] The message to send in JSON format when ratelimit is hit
     * @property {Function} [keyGenerator] The function that handles what key to use in ratelimits
     * @property {Function} [skip] Whether or not we should skip the request from ratelimiting
     */

    /**
     * @param {RatelimiterOptions} [options] The options for the class
     */
    constructor(options = {}) {
        super();

        /**
         * The options for the Ratelimiter
         * @type {RatelimiterOptions}
         */
        this.options = {
            ...options,
            duration: 1000,
            max: 120,
            statusCode: 429,
            message: "Please slow down as you've hit ratelimits.",
            keyGenerator: req => req.ip,
            skip: () => false
        };

        /**
         * A map of all epoch by key
         * @type {Map<string, number>}
         */
        this.times = new Map();

        /**
         * The interval that resets all entries in the map
         * @type {NodeJS.Timer}
         */
        this.resetInterval = setInterval(this.clear.bind(this), this.options.duration);
    }

    /**
     * increments the keys current value or sets it to 1
     * @param {string} key The key for the request
     * @returns {number}
     */
    increment(key) {
        const exists = this.get(key);
        if (exists) this.set(key, exists + 1);
        else this.set(key, 1);
        return this.get(key);
    }

    /**
     * Decreases the values of the key in the Map
     * @param {string} key The key for the request
     * @returns {number}
     */
    decrease(key) {
        const exists = this.get(key);
        if (exists) this.set(key, exists - 1);
        return this.get(key);
    }

    async middleware(req, res, next) {
        // if the skip function is truthy, return next and dont do anything.
        if (await this.options.skip(req, res)) return next();

        // Get the key from the keyGenerator function
        const key = await this.options.keyGenerator(req, res);

        // Increment the key by 1 from the current value or set it to 1.
        const current = this.increment(key);

        // The EPOCH time for when the ratelimit will be over
        const resetTime = this.generateResetTime(key);

        // Add useful infomation to Context aka ctx
        req.rateLimit = {
            current,
            limit: this.options.max,
            remaining: Math.max(this.options.max - current, 0),
            reset: resetTime
        };

        // Set headers
        res.setHeader("X-RateLimit-Limit", this.options.max);
        res.setHeader("X-RateLimit-Remaining", req.rateLimit.remaining);
        res.setHeader("X-RateLimit-Reset", resetTime);

        // if max is set and current amount of requests in duration timeframe is greater than max set headers, status and body then return.
        if (this.options.max && current > this.options.max) {
            res.setHeader("Retry-After", Math.ceil(this.options.duration / 1000));
            res.status(this.options.statusCode).json({ message: this.options.message });
            return next();
        }

        return next();
    }

    /**
     * Generates a EPOCH time when the ratelimit will be over for the X-RateLimit-Reset header
     * @param {string} key The key for the request
     * @returns {number}
     */
    generateResetTime(key) {
        const exists = this.times.get(key);
        if (exists) return exists;
        else this.times.set(key, parseInt((Date.now() / 1000).toFixed(0), 10) + (this.options.duration / 1000));
        return this.times.get(key);
    }

}

module.exports = Ratelimiter;
