/* eslint-disable no-inline-comments */
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

class Ratelimit extends Map {

    constructor(options = {}) {
        super();

        this.options = Ratelimit.mergeDefault(options, {
            windowMs: 30000,
            max: 5,
            statusCode: 429,
            message: "You twat, stop spamming the image server.",
            keyGenerator: req => req.ip,
            skip: () => false
        });

        this.resetInterval = setInterval(this.clear.bind(this), this.options.windowMs);
    }

    incr(key) {
        const exists = this.get(key);
        if (exists) this.set(key, exists + 1);
        else this.set(key, 1);
        return this.get(key);
    }

    decrease(key) {
        const exists = this.get(key);
        if (exists) this.set(key, exists - 1);
        return this.get(key);
    }

    async middleware(req, res, next) {
        if (await this.options.skip(req, res)) return next();

        const key = await this.options.keyGenerator(req, res);

        const current = this.incr(key);

        req.rateLimit = {
            limit: this.options.max,
            current: current,
            remaining: Math.max(this.options.max - current, 0)
        };

        res.setHeader("X-RateLimit-Limit", this.options.max);
        res.setHeader("X-RateLimit-Remaining", req.rateLimit.remaining);

        if (this.options.max && current > this.options.max) {
            res.setHeader("Retry-After", Math.ceil(this.options.windowMs / 1000));
            return res.status(this.options.statusCode).json({ message: this.options.message });
        }

        res.on("finish", () => {
            if (res.statusCode >= 400) this.decrease(key);
        });

        return next();
    }

    static mergeDefault(def, given) {
        if (!given) return def;
        for (const key in def) {
            if (!has(given, key) || given[key] === undefined) {
                given[key] = Array.isArray(def[key]) ? def[key].slice(0) : def[key];
            } else if (!Array.isArray(given[key]) && given[key] === Object(given[key])) {
                given[key] = Ratelimit.mergeDefault(def[key], given[key]);
            }
        }

        return given;
    }

}

module.exports = Ratelimit;
