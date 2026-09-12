export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/garments/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Search */
        post: operations["search_api_garments_search_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/garments/{garment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Garment */
        get: operations["garment_api_garments__garment_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/garments/{garment_id}/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Availability */
        get: operations["availability_api_garments__garment_id__availability_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/bookings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Booking */
        post: operations["booking_api_bookings_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Conversation */
        post: operations["create_conversation_api_conversations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/debug/conversations/{conversation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Debug Conversation */
        get: operations["debug_conversation_api_debug_conversations__conversation_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversation_id}/turn": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Conversation Turn */
        post: operations["conversation_turn_api_conversations__conversation_id__turn_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** BookingResult */
        BookingResult: {
            /** Booking Id */
            booking_id: string;
            /** Garment Id */
            garment_id: string;
            /**
             * Ship By
             * Format: date
             */
            ship_by: string;
            /**
             * Lands On
             * Format: date
             */
            lands_on: string;
            /**
             * Wear From
             * Format: date
             */
            wear_from: string;
            /**
             * Wear To
             * Format: date
             */
            wear_to: string;
            /**
             * Free Again
             * Format: date
             */
            free_again: string;
            /**
             * Payment Taken
             * @default false
             * @constant
             */
            payment_taken?: false;
            /**
             * Status
             * @default reserved
             * @constant
             */
            status?: "reserved";
            /**
             * Already Existed
             * @default false
             */
            already_existed?: boolean;
        };
        /**
         * Category
         * @enum {string}
         */
        Category: "dress" | "jewellery" | "bag";
        /** CreateBookingIn */
        CreateBookingIn: {
            /** City */
            city: string;
            /**
             * Wear Date
             * Format: date
             */
            wear_date: string;
            /** Return Date */
            return_date?: string | null;
            /** Sizes Eu */
            sizes_eu: number[];
            /** Garment Id */
            garment_id: string;
            /** Borrower Name */
            borrower_name?: string | null;
            /** Idempotency Key */
            idempotency_key: string;
        };
        /** CreateConversation */
        CreateConversation: {
            /**
             * Role
             * @default borrower
             * @constant
             */
            role?: "borrower";
        };
        /** Feasibility */
        Feasibility: {
            /** Garment Id */
            garment_id: string;
            /** Feasible */
            feasible: boolean;
            /**
             * Ship By
             * Format: date
             */
            ship_by: string;
            /**
             * Lands On
             * Format: date
             */
            lands_on: string;
            /**
             * Wear From
             * Format: date
             */
            wear_from: string;
            /**
             * Wear To
             * Format: date
             */
            wear_to: string;
            /**
             * Free Again
             * Format: date
             */
            free_again: string;
            /** @default null */
            reason?: components["schemas"]["Reason"] | null;
            /**
             * Blocking Booking Id
             * @default null
             */
            blocking_booking_id?: string | null;
        };
        /** GarmentPublic */
        GarmentPublic: {
            /** Id */
            id: string;
            /** Sku */
            sku: string;
            /** Name */
            name: string;
            /** Name Raw */
            name_raw: string;
            /** Designer */
            designer: string;
            category: components["schemas"]["Category"];
            /** Silhouette */
            silhouette: string | null;
            /** Colour Family */
            colour_family: string | null;
            /** Occasion */
            occasion: components["schemas"]["Occasion"][];
            /** Formality */
            formality: number;
            /** Style Tags */
            style_tags: string[];
            /** Sizes Eu */
            sizes_eu: number[];
            /** Rental Price */
            rental_price: number;
            /** Retail Price */
            retail_price: number;
            /** Rental Days */
            rental_days: number;
            /** Image */
            image: string;
            /** Lender Id */
            lender_id: string;
            /** Lender Name */
            lender_name: string;
            /** City */
            city: string;
            /** Lender Rating */
            lender_rating: number;
            /** Delivery Days */
            delivery_days: number;
            /** Return Days */
            return_days: number;
            /** Cleaning Days */
            cleaning_days: number;
            /** Condition */
            condition: string;
            /** Description */
            description: string;
            /** Is Sized */
            is_sized: boolean;
            /**
             * Available From
             * Format: date
             */
            available_from: string;
            /**
             * Available To
             * Format: date
             */
            available_to: string;
            /** Thumb */
            thumb: string;
            /**
             * Image Credit
             * @default null
             */
            image_credit?: string | null;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /**
         * Occasion
         * @enum {string}
         */
        Occasion: "gala" | "party" | "formal" | "engagement" | "wedding" | "weekend";
        /**
         * Reason
         * @enum {string}
         */
        Reason: "WRONG_CITY" | "SIZE_MISMATCH" | "TOO_LATE_TO_SHIP" | "OUTSIDE_LENDER_WINDOW" | "OVERLAPS_BOOKING" | "IN_CLEANING";
        /** SearchHit */
        SearchHit: {
            garment: components["schemas"]["GarmentPublic"];
            feasibility: components["schemas"]["Feasibility"];
            /** Score */
            score: number;
        };
        /** SearchRequest */
        SearchRequest: {
            /** City */
            city: string;
            /**
             * Wear Date
             * Format: date
             */
            wear_date: string;
            /** Return Date */
            return_date?: string | null;
            /** Sizes Eu */
            sizes_eu?: number[];
            /** @default dress */
            category?: components["schemas"]["Category"];
            occasion?: components["schemas"]["Occasion"] | null;
            /** Colour Family */
            colour_family?: string | null;
            /** Style Hints */
            style_hints?: string[];
            /** Max Price */
            max_price?: number | null;
            /**
             * Limit
             * @default 20
             */
            limit?: number;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /** Availability */
        Availability: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "availability";
            feasibility: components["schemas"]["Feasibility"];
            garment: components["schemas"]["GarmentPublic"];
        };
        /** BookingClaim */
        BookingClaim: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "booking_claim";
            booking: components["schemas"]["BookingResult"];
        };
        /** Done */
        Done: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "done";
            /** Conversation Id */
            conversation_id: string;
        };
        /** Error */
        Error: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "error";
            /** Message */
            message: string;
            /**
             * Recoverable
             * @default true
             */
            recoverable?: boolean;
            /** Code */
            code: string;
        };
        /** Question */
        Question: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "question";
            /** Text */
            text: string;
            /** Fields */
            fields: string[];
        };
        /** Results */
        Results: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "results";
            /** Hits */
            hits: components["schemas"]["SearchHit"][];
            /**
             * Relaxed
             * @default null
             */
            relaxed?: null;
            /** Result Id */
            result_id: string;
        };
        /** Token */
        Token: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            event: "token";
            /** Text */
            text: string;
        };
        BorrowerEvent: components["schemas"]["Token"] | components["schemas"]["Question"] | components["schemas"]["Results"] | components["schemas"]["Availability"] | components["schemas"]["BookingClaim"] | components["schemas"]["Error"] | components["schemas"]["Done"];
        /** Turn */
        Turn: {
            /**
             * Text
             * @default
             */
            text?: string;
            /**
             * Intent
             * @default message
             * @enum {string}
             */
            intent?: "message" | "book";
            /**
             * Garment Id
             * @default null
             */
            garment_id?: string | null;
            /**
             * Confirmed
             * @default false
             */
            confirmed?: boolean;
            /**
             * Result Id
             * @default null
             */
            result_id?: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    search_api_garments_search_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SearchRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchHit"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    garment_api_garments__garment_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                garment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GarmentPublic"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    availability_api_garments__garment_id__availability_get: {
        parameters: {
            query: {
                wear: string;
                city: string;
                sizes_eu?: number[];
                return?: string | null;
            };
            header?: never;
            path: {
                garment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Feasibility"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    booking_api_bookings_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateBookingIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BookingResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_conversation_api_conversations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateConversation"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    debug_conversation_api_debug_conversations__conversation_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    conversation_turn_api_conversations__conversation_id__turn_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Text
                     * @default
                     */
                    text?: string;
                    /**
                     * Intent
                     * @default message
                     * @enum {string}
                     */
                    intent?: "message" | "book";
                    /** Garment Id */
                    garment_id?: string | null;
                    /**
                     * Confirmed
                     * @default false
                     */
                    confirmed?: boolean;
                    /** Result Id */
                    result_id?: string | null;
                };
                "multipart/form-data": {
                    /**
                     * Text
                     * @default
                     */
                    text?: string;
                    /**
                     * Intent
                     * @default message
                     * @enum {string}
                     */
                    intent?: "message" | "book";
                    /** Garment Id */
                    garment_id?: string | null;
                    /**
                     * Confirmed
                     * @default false
                     */
                    confirmed?: boolean;
                    /** Result Id */
                    result_id?: string | null;
                };
            };
        };
        responses: {
            /** @description SSE events ending in done */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                    "text/event-stream": string;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
