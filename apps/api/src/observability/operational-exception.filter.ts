import {
    ArgumentsHost,
    Catch,
    HttpException,
    InternalServerErrorException,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { classifyOperationalFailure } from './operational-errors.js';

@Catch()
export class OperationalExceptionFilter extends BaseExceptionFilter {
    private readonly logger = new Logger(OperationalExceptionFilter.name);

    override catch(exception: unknown, host: ArgumentsHost): void {
        if (exception instanceof HttpException) {
            super.catch(exception, host);
            return;
        }

        const failure = classifyOperationalFailure(exception);

        this.logger.error(
            `request_failed subsystem=${failure.subsystem} category=${failure.category}`,
        );

        if (failure.transient) {
            super.catch(
                new ServiceUnavailableException('A required service is temporarily unavailable'),
                host,
            );
            return;
        }

        super.catch(new InternalServerErrorException('Internal server error'), host);
    }
}
