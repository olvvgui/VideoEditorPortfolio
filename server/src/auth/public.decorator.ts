import { SetMetadata } from "@nestjs/common";
export const PUBLIC_ROUTE = "frame:public";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
