import defaultTheme from "tailwindcss/defaultTheme";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

export default {
    content: [
        "./resources/**/*.blade.php",
        "./resources/**/*.js",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Cairo", "Tajawal", ...defaultTheme.fontFamily.sans],
                display: ["Tajawal", "Cairo", ...defaultTheme.fontFamily.sans],
            },
            colors: {
                brand: {
                    50:  "#fdf6ed",
                    100: "#fae8cd",
                    200: "#f4d199",
                    300: "#edb260",
                    400: "#e69637",
                    500: "#d97b1c",
                    600: "#bf6115",
                    700: "#994914",
                    800: "#7c3c17",
                    900: "#673318",
                },
                gold: {
                    400: "#d4af37",
                    500: "#c5a028",
                    600: "#a88520",
                },
            },
            boxShadow: {
                soft: "0 2px 12px -2px rgb(0 0 0 / 0.08)",
                card: "0 4px 24px -6px rgb(0 0 0 / 0.10)",
            },
        },
    },
    plugins: [forms, typography],
};
