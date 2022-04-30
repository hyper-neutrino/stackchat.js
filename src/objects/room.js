import he from "he";
import { parse } from "node-html-parser";
import { WebSocket } from "ws";
import { BlockTrigger } from "../lib/block.js";
import { Cache } from "./cache.js";
import { WebsocketError } from "./errors.js";

const messageEvents = new Set([1, 2, 6, 8, 18, 20]);

export class Room {
    constructor(client, id, { messageCacheLimit } = {}) {
        this.client = client;
        this.id = id;

        this.listeners = new Map();
        this.ws = null;

        this.messages = new Cache(messageCacheLimit);
        this.name = undefined;

        this.client
            .request(`https://chat.stackexchange.com/rooms/info/${id}`)
            .then(
                (res) =>
                    (this.name = he.decode(
                        parse(res.body).querySelector("div.subheader h1")
                            .innerHTML
                    ))
            );

        this.moveOutBuffer = new BlockTrigger();
        this.moveInBuffer = new BlockTrigger();
    }

    toString() {
        return `<Room ${this.id}>`;
    }

    async fetchName() {
        return (this.name = he.decode(
            parse(
                (
                    await this.client.request(
                        `https://chat.stackexchange.com/rooms/info/${this.id}`
                    )
                ).body
            ).querySelector("div.subheader h1").innerHTML
        ));
    }

    async connectWs() {
        const payload = { fkey: this.client.fkey, roomid: this.id };
        let res;

        try {
            res = JSON.parse(
                (
                    await this.client.request(
                        "https://chat.stackexchange.com/ws-auth",
                        { payload }
                    )
                ).body
            );
        } catch (error) {
            throw new WebsocketError(
                `failed to connect to room ${this.id}`,
                error
            );
        }

        this.ws = new WebSocket(`${res.url}?l=${new Date().getTime()}`, {
            headers: { Origin: "https://chat.stackexchange.com" },
        });

        await new Promise((resolve) => this.ws.once("open", resolve));

        this.ws.on("message", (data) => {
            data = JSON.parse(data);

            const info = data[`r${this.id}`];
            if (!info || !info.e) return;

            for (const event of info.e) {
                const string = JSON.stringify(event);

                event.room = this;
                event.client = this.client;

                if (event.message_id) {
                    event.transcript_link = `https://chat.stackexchange.com/transcript/message/${event.message_id}`;
                }

                if (messageEvents.has(event.event_type)) {
                    event.reply = (content) =>
                        this.send(`:${event.message_id} ${content}`);
                }

                if (event.user_name) {
                    event.mention = `@${event.user_name.replaceAll(
                        /\s+/g,
                        ""
                    )}`;
                }

                switch (event.event_type) {
                    case 1:
                        this.messages.set(event.message_id, event);
                        this.trigger("messageCreate", event);
                        break;
                    case 2:
                        const before = this.messages.get(event.message_id);
                        this.messages.set(event.message_id, event);
                        this.trigger("messageUpdate", before, event);
                        break;
                    case 3:
                        this.trigger("userJoin", event);
                        break;
                    case 4:
                        this.trigger("userLeave", event);
                        break;
                    case 5:
                        this.trigger("roomNameUpdate", this.name, event);
                        break;
                    case 6:
                        this.trigger("messageStarUpdate", event);
                        break;
                    case 8:
                        this.trigger("ping", event);
                        break;
                    case 10:
                        this.trigger(
                            "messageDelete",
                            this.messages.get(event.message_id),
                            event
                        );
                        this.messages.delete(event.message_id);
                        break;
                    case 15:
                        if (event.target_user_id) {
                            this.trigger("userAccessUpdate", event);
                        } else {
                            this.trigger("globalAccessUpdate", event);
                        }
                        break;
                    case 17:
                        this.trigger("invite", event);
                        break;
                    case 18:
                        this.trigger("messageReplyCreate", event);
                        break;
                    case 19:
                        this.trigger("messageMoveOut", event);
                        this.moveOutBuffer.insert(event, (events) =>
                            this.trigger("messageBlockMoveOut", events)
                        );
                        break;
                    case 20:
                        this.trigger("messageMoveIn", event);
                        this.moveInBuffer.insert(event, (events) =>
                            this.trigger("messageBlockMoveIn", events)
                        );
                        break;
                    case 22:
                        this.trigger("feedTicker", event);
                        break;
                    case 29:
                        const code = event.content.split(" ")[0];
                        const data = JSON.parse(
                            event.content.slice(code.length + 1)
                        );

                        if (code == "4") {
                            this.trigger("userSuspensionAdd", event, data.new);
                        } else if (code == "5") {
                            this.trigger(
                                "userSuspensionRemove",
                                event,
                                data.old
                            );
                        }

                        break;
                    default:
                        console.log(string);
                        break;
                }
            }
        });
    }

    async send(content) {
        return await this.client.send(this.id, content);
    }

    async editMessage(messageId, content) {
        return await this.client.editMessage(this.id, messageId, content);
    }

    async deleteMessage(messageId) {
        return await this.client.deleteMessage(this.id, messageId);
    }

    async pinMessage(messageId) {
        return await this.client.pinMessage(this.id, messageId);
    }

    on(event, listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(listener);
    }

    trigger(event, ...data) {
        this.client.trigger(event, ...data);

        for (const listener of this.listeners.get(event) ?? []) {
            listener(...data);
        }
    }
}
