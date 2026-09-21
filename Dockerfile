# 多阶段构建：Node 负责构建，nginx 只负责提供静态文件。
# 见 specs/项目结构.md §2 —— 这个镜像存在的唯一目的是满足「可自托管」这条产品承诺。

FROM node:24-alpine AS build
WORKDIR /app

# 先只拷贝依赖清单，让 npm ci 这一层能被缓存
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
