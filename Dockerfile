FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY target/upgrader-game-1.0-SNAPSHOT.jar app.jar
EXPOSE 4567
CMD ["java", "-jar", "app.jar"]