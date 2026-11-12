# Isolated Render staging container for the SAP application.
# The frontend Firebase config is replaced with a non-routable placeholder
# so this staging deployment cannot read or write to the Firebase project
# configured in the source repository.
FROM oven/bun:1.4.0

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN printf '%s\n' '{"apiKey":"staging-disabled-not-a-real-key","authDomain":"staging.invalid","projectId":"staging-disabled","appId":"1:0:web:staging","firestoreDatabaseId":"(default)"}' > firebase-applet-config.json

RUN bun run lint && bun run build

ENV NODE_ENV=production
ENV PORT=10000
ENV GEMINI_API_KEY=staging-disabled
ENV DISABLE_HMR=true

EXPOSE 10000

CMD ["bun", "run", "start"]
