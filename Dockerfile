FROM openjdk:17-jdk-slim
WORKDIR /app
COPY target/upgrader-game-1.0-SNAPSHOT.jar app.jar
COPY items.json items.json
EXPOSE 4567
CMD ["java", "-jar", "app.jar"]