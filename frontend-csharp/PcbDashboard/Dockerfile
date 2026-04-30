FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore ./PcbDashboard.csproj
RUN dotnet publish ./PcbDashboard.csproj -c Release -o /app/publish

FROM nginx:alpine
ARG API_BASE_URL=http://localhost:8080
ARG EDGE_BASE_URL=http://localhost:8000
COPY --from=build /app/publish/wwwroot /usr/share/nginx/html
RUN sed -i "s|\"ApiBaseUrl\": \"http://localhost:5000\"|\"ApiBaseUrl\": \"${API_BASE_URL}\"|g" /usr/share/nginx/html/appsettings.json \
 && sed -i "s|\"EdgeBaseUrl\": \"http://localhost:8000\"|\"EdgeBaseUrl\": \"${EDGE_BASE_URL}\"|g" /usr/share/nginx/html/appsettings.json \
 && rm -f /usr/share/nginx/html/appsettings.json.gz /usr/share/nginx/html/appsettings.json.br
EXPOSE 80
