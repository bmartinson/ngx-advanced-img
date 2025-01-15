import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { NgxAdvancedImgModule } from '../../projects/ngx-advanced-img/src/public-api';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FormsModule, NgxAdvancedImgModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
