/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                // True-neutral gray (no blue cast). Overrides Tailwind's default
                // cool-toned `gray` so every `gray-*` surface reads pure black & white.
                gray: {
                    50: "#fafafa",
                    100: "#f5f5f5",
                    200: "#e5e5e5",
                    300: "#d4d4d4",
                    400: "#a3a3a3",
                    500: "#737373",
                    600: "#525252",
                    700: "#404040",
                    800: "#262626",
                    900: "#171717",
                    950: "#0a0a0a",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },

            // V-- ADD THIS ENTIRE TYPOGRAPHY SECTION --V
            typography: ({ theme }) => ({
                DEFAULT: {
                    css: {
                        '--tw-prose-body': theme('colors.slate[700]'),
                        '--tw-prose-headings': theme('colors.slate[900]'),
                        '--tw-prose-lead': theme('colors.slate[600]'),
                        '--tw-prose-links': theme('colors.primary.DEFAULT'),
                        '--tw-prose-bold': theme('colors.slate[900]'),
                        '--tw-prose-counters': theme('colors.slate[500]'),
                        '--tw-prose-bullets': theme('colors.primary.DEFAULT'),
                        '--tw-prose-hr': theme('colors.slate[200]'),
                        '--tw-prose-quotes': theme('colors.slate[900]'),
                        '--tw-prose-quote-borders': theme('colors.primary.DEFAULT'),
                        '--tw-prose-captions': theme('colors.slate[500]'),
                        '--tw-prose-code': theme('colors.slate[900]'),
                        '--tw-prose-pre-code': theme('colors.slate[200]'),
                        '--tw-prose-pre-bg': theme('colors.slate[800]'),
                        '--tw-prose-th-borders': theme('colors.slate[300]'),
                        '--tw-prose-td-borders': theme('colors.slate[200]'),
                        '--tw-prose-invert-body': theme('colors.slate[300]'),
                        '--tw-prose-invert-headings': theme('colors.slate[50]'),
                        '--tw-prose-invert-lead': theme('colors.slate[400]'),
                        '--tw-prose-invert-links': theme('colors.primary.DEFAULT'),
                        '--tw-prose-invert-bold': theme('colors.slate[50]'),
                        '--tw-prose-invert-counters': theme('colors.slate[400]'),
                        '--tw-prose-invert-bullets': theme('colors.primary.DEFAULT'),
                        '--tw-prose-invert-hr': theme('colors.slate[700]'),
                        '--tw-prose-invert-quotes': theme('colors.slate[100]'),
                        '--tw-prose-invert-quote-borders': theme('colors.primary.DEFAULT'),
                        '--tw-prose-invert-captions': theme('colors.slate[400]'),
                        '--tw-prose-invert-code': theme('colors.slate[50]'),
                        '--tw-prose-invert-pre-code': theme('colors.slate[300]'),
                        '--tw-prose-invert-pre-bg': 'rgb(23 30 43 / 50%)',
                        '--tw-prose-invert-th-borders': theme('colors.slate[600]'),
                        '--tw-prose-invert-td-borders': theme('colors.slate[700]'),
                        'h1, h2, h3, h4, h5, h6': {
                            fontFamily: "var(--font-outfit), sans-serif",
                        },
                        p: {
                            lineHeight: '1.7',
                        },
                        blockquote: {
                            paddingLeft: '1rem',
                            borderLeftWidth: '0.25rem',
                            fontStyle: 'normal',
                            fontWeight: '500',
                        },
                        'ol > li::before': {
                            color: 'var(--tw-prose-counters)',
                            fontWeight: '600',
                        }
                    },
                },
            }),
            // ^-- END OF TYPOGRAPHY SECTION --^
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        require("@tailwindcss/typography"), // <-- ADD THIS PLUGIN
    ],
};