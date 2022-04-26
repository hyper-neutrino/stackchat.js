export class BlockTrigger {
    constructor() {
        this.timer = null;
        this.events = [];
    }

    insert(event, call) {
        this.events.push(event);

        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => {
            call(this.events);
            this.events = [];
        }, 250);
    }
}
