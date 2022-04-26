export class Cache {
    constructor(max = 10000) {
        this.max = max;
        this.keys = [];
        this.store = new Map();
    }

    set(key, value) {
        if (!this.store.has(key)) {
            this.keys.push(key);
            if (this.keys.length > this.max) {
                this.store.delete(this.keys[0]);
                this.keys = this.keys.filter((key) => this.store.has(key));
            }
        }

        this.store.set(key, value);
    }

    get(key) {
        return this.store.get(key);
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.keys = [];
        this.store.clear();
    }
}
