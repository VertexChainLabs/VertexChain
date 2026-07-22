import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { dump } from 'js-yaml';
import { AppModule } from './app.module';

const docsDir = join(__dirname, '..', '..', 'infrastructure', 'docs');

(async () => {
  try {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Gist API')
      .setDescription('Anonymous hyperlocal messaging on Stellar')
      .setVersion('0.1.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'openapi.json'), JSON.stringify(document, null, 2));
    writeFileSync(join(docsDir, 'openapi.yaml'), dump(document));

    await app.close();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
