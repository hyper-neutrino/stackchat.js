import http from "http";
import https from "https";

import { Jar } from "./jar.js";

const globalJar = new Jar();

export default async function request(
    url,
    { payload, headers = {}, jar = globalJar, options } = {}
) {
    return new Promise((resolve, reject) => {
        const parts = url.split(":");

        let protocol, name, postContent;

        if (parts[0] == "http" || parts[0] == "https") {
            protocol = parts.shift();
            name = parts.join(":").slice(2);
        } else {
            protocol = "http";
            name = parts.join(":");
        }

        const domain = name.split("/")[0];
        const path = name.substring(domain.length);

        headers.Accept ??= "*/*";

        const cookies = jar.getCookies(domain);
        if (cookies) headers.Cookie = cookies;

        options = {
            hostname: domain,
            port: protocol == "http" ? 80 : 443,
            path,
            headers,
            ...(options ?? {}),
        };

        if (payload) {
            options.method = "POST";

            postContent = new URLSearchParams(payload).toString();

            if (postContent.length) {
                options.headers["Content-Type"] =
                    "application/x-www-form-urlencoded";
            }

            options.headers["Content-Length"] = postContent.length;
        } else {
            options.method = "GET";
        }

        const data = (protocol == "http" ? http : https).request(
            options,
            (response) => {
                const cookies = response.headers["set-cookie"];

                if (cookies) {
                    for (const cookie of cookies) {
                        jar.addCookie(domain, cookie);
                    }
                }

                if (
                    response.statusCode == 300 ||
                    response.statusCode == 301 ||
                    response.statusCode == 302
                ) {
                    resolve(
                        request(
                            (response.headers.location[0] == "/"
                                ? `${protocol}://${domain}`
                                : "") + response.headers.location,
                            { jar }
                        )
                    );
                } else {
                    let body = "";

                    response.setEncoding("utf-8");

                    response.on("data", (chunk) => (body += chunk.toString()));
                    response.on("end", () =>
                        resolve({ statusCode: response.statusCode, body })
                    );
                }
            }
        );

        data.on("error", reject);

        if (payload) data.write(postContent);

        data.end();
    });
}
